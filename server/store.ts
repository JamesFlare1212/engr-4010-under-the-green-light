import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';
import { bi, type Room, type RoomView, type Session, type Command, type Settings } from '../shared/types';
import { execute, GameFault, log, newRoom, requireThat, validateArchive } from './engine';
import { gmContext } from './private-content';
import { randomInt, createHash } from 'node:crypto';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
export class Store {
  db: Database;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path, { create: true, strict: true });
    const version = this.db.query('PRAGMA user_version').get() as { user_version: number };
    if (version.user_version > 1) {
      this.db.close();
      throw new Error('数据库版本高于本应用支持的版本，拒绝降级写入。 Database schema is newer than this application.');
    }
    this.db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, state TEXT NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, room_code TEXT NOT NULL REFERENCES rooms(code), member_id TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS commands (room_code TEXT NOT NULL REFERENCES rooms(code), member_id TEXT NOT NULL, command_id TEXT NOT NULL, PRIMARY KEY(room_code, member_id, command_id));
      PRAGMA user_version = 1;`);
  }
  room(code: string): Room {
    const row = this.db.query('SELECT state FROM rooms WHERE code = ?').get(code) as { state: string } | null;
    requireThat(row, '找不到这个房间，请检查四位房间码。', 'Room not found. Check the four-digit code.', 'not_found', 404);
    return JSON.parse(row.state);
  }
  save(room: Room) {
    this.db.query('INSERT INTO rooms(code,state,updated_at) VALUES(?,?,?) ON CONFLICT(code) DO UPDATE SET state=excluded.state, updated_at=excluded.updated_at').run(room.code, JSON.stringify(room), Date.now());
  }
  code() {
    for (let n = 0; n < 200; n++) {
      const code = String(randomInt(1000, 10000));
      if (!this.db.query('SELECT 1 FROM rooms WHERE code = ?').get(code)) return code;
    }
    throw new GameFault('capacity', bi('房间暂时已满，请联系管理员。', 'Room capacity reached. Contact the administrator.'), 503);
  }
  session(room: Room, memberId: string): Session {
    const token = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    this.db.query('INSERT INTO sessions(token_hash,room_code,member_id) VALUES(?,?,?)').run(hash(token), room.code, memberId);
    return { code: room.code, token, memberId, name: room.members.find(m => m.id === memberId)!.name };
  }
  create(name: string, settings: Settings) {
    return this.db.transaction(() => {
      const room = newRoom(this.code(), name, settings);
      log(room, room.hostId, bi('创建救援房间。', 'Created the rescue room.'));
      this.save(room);
      return this.session(room, room.hostId);
    })();
  }
  join(code: string, name: string) {
    return this.db.transaction(() => {
      const room = this.room(code);
      requireThat(room.members.length < 40, '此房间已达到 40 人上限。', 'This room has reached its 40-person limit.');
      const member = { id: crypto.randomUUID(), name, role: 'player' as const, character: 'engineer', leads: 0, joinedAt: Date.now() };
      room.members.push(member); room.revision++;
      log(room, member.id, bi(`${name} 加入了房间。`, `${name} joined the room.`));
      this.save(room); return this.session(room, member.id);
    })();
  }
  restore(save: unknown, name: string) {
    return this.db.transaction(() => {
      const room = validateArchive(save);
      room.id = crypto.randomUUID(); room.code = this.code(); room.revision = 0; room.createdAt = Date.now();
      room.members.find(m => m.id === room.hostId)!.name = name;
      room.clock.runningSince = null;
      for (const check of room.checks.filter(c => !c.result)) { check.status = 'recruiting'; check.responses = {}; check.eligible = []; check.leadId = null; check.supportId = null; }
      for (const poll of room.polls.filter(p => p.status === 'open' || p.tied.length)) { poll.status = 'closed'; poll.tied = []; poll.closeReason = 'archive-restored'; }
      log(room, room.hostId, bi('从存档创建新房间。历史身份保留但不继承登录权限；请将不再参与的成员设为观察者，重新开放未完成申请或路线投票。', 'Created a new room from a save. Historical identities remain without login access. Set inactive members to observers and reopen pending recruitment or route voting.'));
      this.save(room); return this.session(room, room.hostId);
    })();
  }
  authenticate(code: string, token: string) {
    const row = this.db.query('SELECT member_id FROM sessions WHERE room_code = ? AND token_hash = ?').get(code, hash(token)) as { member_id: string } | null;
    requireThat(row, '登录凭据已失效，请重新加入房间。', 'Your session is invalid. Join the room again.', 'unauthorized', 401);
    const room = this.room(code);
    const member = room.members.find(m => m.id === row.member_id);
    requireThat(member, '成员身份已失效，请重新加入。', 'Membership is invalid. Join again.', 'unauthorized', 401);
    return { room, member };
  }
  command(code: string, token: string, command: Command) {
    return this.db.transaction(() => {
      const { room, member } = this.authenticate(code, token);
      if (this.db.query('SELECT 1 FROM commands WHERE room_code=? AND member_id=? AND command_id=?').get(code, member.id, command.id)) return room;
      // 玩家操作绑定具体行动/投票 ID，允许多人基于同一版本并发提交。
      const concurrent = ['vote', 'volunteer', 'roll', 'profile', 'reflection'].includes(command.type);
      requireThat(concurrent || room.revision === command.revision, '场次已被其他成员更新，已同步最新状态，请检查后重试。', 'Another member updated this session. The latest state is synced; review it and try again.', 'conflict', 409);
      execute(room, member, command.type, command.payload);
      room.revision++;
      this.save(room);
      this.db.query('INSERT INTO commands(room_code,member_id,command_id) VALUES(?,?,?)').run(code, member.id, command.id);
      return room;
    })();
  }
  view(room: Room, memberId: string, online: string[]): RoomView {
    const { gmNotes, polls, ...publicState } = room;
    const gm = room.members.find(m => m.id === memberId)?.role === 'gm';
    return {
      ...publicState, me: memberId, online,
      ...(gm ? { gmNotes, gmContext } : {}),
      polls: polls.map(poll => {
        const { ballots, ...rest } = poll;
        return { ...rest, voted: Object.keys(ballots), myVote: ballots[memberId] ?? null, counts: poll.status === 'closed' ? Object.fromEntries(poll.options.map(option => [option.id, Object.values(ballots).filter(v => v === option.id).length])) : null };
      })
    };
  }
  export(room: Room) {
    const copy = structuredClone(room);
    if (copy.clock.runningSince) copy.clock.elapsed += Date.now() - copy.clock.runningSince;
    copy.clock.runningSince = null;
    return { format: 'green-light-save', version: 1, exportedAt: new Date().toISOString(), room: copy };
  }
}
export const commandSchema = z.object({ id: z.string().uuid(), revision: z.number().int().nonnegative(), type: z.string().min(1).max(50), payload: z.record(z.string(), z.unknown()).optional() });
