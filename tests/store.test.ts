import { test, expect, afterEach } from 'bun:test';
import { Store } from '../server/store';
import { GameFault } from '../server/engine';
import type { Session } from '../shared/types';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });
function fixture(path = ':memory:') {
  const store = new Store(path); cleanup.push(() => store.db.close());
  const host = store.create('GM', { mode: 'short', gmCount: 2, dice: 'physical' });
  const second = store.join(host.code, 'Co-GM'); const player = store.join(host.code, 'Player');
  function send(s: Session, type: string, payload: Record<string, unknown> = {}, revision = store.room(host.code).revision, commandId = crypto.randomUUID()) {
    return store.command(host.code, s.token, { id: commandId, revision, type, payload });
  }
  send(host, 'role', { memberId: second.memberId, role: 'gm' });
  return { store, host, second, player, send };
}
test('Co-GM 同时推进时只有一个命令成功，另一位获得版本冲突', () => {
  const f = fixture(); const revision = f.store.room(f.host.code).revision;
  f.send(f.host, 'next', {}, revision);
  expect(() => f.send(f.second, 'next', {}, revision)).toThrow(); expect(f.store.room(f.host.code).phase).toBe('briefing');
});
test('相同命令重试幂等：推进、掷骰、物资投票不会重复执行', () => {
  const f = fixture(); const commandId = crypto.randomUUID(), revision = f.store.room(f.host.code).revision;
  const first = f.send(f.host, 'next', {}, revision, commandId); const retried = f.send(f.host, 'next', {}, revision, commandId);
  expect(retried.phase).toBe('briefing'); expect(retried.revision).toBe(first.revision);
  const room = f.store.room(f.host.code); room.phase = 'execution'; f.store.save(room);
  f.send(f.host, 'open_check', { objective: 'access', action: 'plan', backup: 'backup', bonus: 0, bonusReason: '', creative: 0 });
  const checkId = f.store.room(f.host.code).checks[0]!.id; f.send(f.player, 'volunteer', { checkId, willing: true });
  const rollId = crypto.randomUUID(); f.send(f.host, 'roll', { checkId, die: 9 }, undefined, rollId); f.send(f.host, 'roll', { checkId, die: 9 }, undefined, rollId);
  const pollId = f.store.room(f.host.code).polls[0]!.id, voteId = crypto.randomUUID();
  f.send(f.player, 'vote', { pollId, option: 'spend' }, undefined, voteId); f.send(f.player, 'vote', { pollId, option: 'spend' }, undefined, voteId);
  expect(f.store.room(f.host.code).emergencyKits).toBe(2);
  const closeId = crypto.randomUUID(), closeRevision = f.store.room(f.host.code).revision;
  f.send(f.host, 'close_vote', { pollId }, closeRevision, closeId); f.send(f.host, 'close_vote', { pollId }, closeRevision, closeId);
  expect(f.store.room(f.host.code).emergencyKits).toBe(1); expect(f.store.room(f.host.code).checks[0]!.result?.tier).toBe('near_miss');
});
test('玩家快照不泄漏主持上下文、私密笔记、他人票选或会话凭证', () => {
  const f = fixture(); const r = f.store.room(f.host.code); r.phase = 'route_choice'; r.gmNotes = 'SECRET GM NOTE'; f.store.save(r); const other = f.store.join(f.host.code, 'Other'); f.send(f.host, 'route_vote'); f.send(other, 'vote', { pollId: f.store.room(f.host.code).polls[0]!.id, option: 'high_line' });
  const room = f.store.room(f.host.code), view = f.store.view(room, f.player.memberId, []);
  const raw = JSON.stringify(view); expect(raw).not.toContain('SECRET'); expect(view.gmNotes).toBeUndefined(); expect(view.gmContext).toBeUndefined(); expect(view.polls[0]!.counts).toBeNull(); expect(view.polls[0]!.myVote).toBeNull(); expect('ballots' in view.polls[0]!).toBeFalse(); expect(raw).not.toContain(f.host.token);
  expect(f.store.view(room, f.host.memberId, []).gmNotes).toBe('SECRET GM NOTE');
});
test('玩家不能提升自身权限、推进剧本、读他人的房间凭证', () => {
  const f = fixture(); expect(() => f.send(f.player, 'role', { memberId: f.player.memberId, role: 'gm' })).toThrow(); expect(() => f.send(f.player, 'next')).toThrow();
  const other = f.store.create('Other', { mode: 'short', gmCount: 1, dice: 'physical' }); expect(() => f.store.authenticate(other.code, f.host.token)).toThrow();
  const rows = f.store.db.query('SELECT token_hash FROM sessions').all() as { token_hash: string }[]; expect(rows.some(r => r.token_hash === f.host.token)).toBeFalse();
});
test('SQLite 重启后保留进度与登录；导入新房间不会继承旧令牌', () => {
  const dir = mkdtempSync(join(tmpdir(), 'green-light-test-')); cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'game.sqlite'); let store = new Store(path);
  const host = store.create('GM', { mode: 'short', gmCount: 1, dice: 'virtual' }); const player = store.join(host.code, 'P');
  store.command(host.code, host.token, { id: crypto.randomUUID(), revision: store.room(host.code).revision, type: 'next' });
  const archive = store.export(store.room(host.code)); store.db.close(); store = new Store(path); cleanup.push(() => store.db.close());
  expect(store.authenticate(host.code, host.token).room.phase).toBe('briefing'); expect(store.authenticate(host.code, player.token).member.id).toBe(player.memberId);
  const imported = store.restore(archive, 'Restored GM'); expect(imported.code).not.toBe(host.code); expect(store.room(imported.code).phase).toBe('briefing'); expect(() => store.authenticate(imported.code, host.token)).toThrow();
});
test('拒绝降级写入未来数据库版本', () => {
  const dir = mkdtempSync(join(tmpdir(), 'green-light-version-')); cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'game.sqlite'); const store = new Store(path); store.db.exec('PRAGMA user_version=2'); store.db.close();
  expect(() => new Store(path)).toThrow('Database schema is newer');
});
