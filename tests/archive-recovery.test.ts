import { afterEach, expect, test } from 'bun:test';
import { Store } from '../server/store';
import { createApp } from '../server/index';
import { GameFault, validateArchive } from '../server/engine';
import { maxArchiveBytes, maxCommandRequestBytes, maxImportRequestBytes, stringifyArchive, utf8Bytes } from '../shared/archive';
import { memberById, memberName } from '../shared/members';
import { bi, objectives, type Room, type Session } from '../shared/types';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });
function fixture(gmCount = 1) {
  const store = new Store(':memory:'); cleanup.push(() => store.db.close());
  const host = store.create('Original GM', { mode: 'short', gmCount, dice: 'physical' });
  const send = (session: Session, type: string, payload: Record<string, unknown> = {}, id = crypto.randomUUID()) => store.command(session.code, session.token, {
    id, revision: store.room(session.code).revision, type, payload
  });
  return { store, host, send };
}
function execution(f: ReturnType<typeof fixture>, player: Session) {
  f.send(f.host, 'next'); f.send(f.host, 'next'); f.send(f.host, 'next');
  let poll = f.store.room(f.host.code).polls.at(-1)!;
  f.send(player, 'vote', { pollId: poll.id, option: 'both' }); f.send(f.host, 'close_vote', { pollId: poll.id });
  f.send(f.host, 'next'); poll = f.store.room(f.host.code).polls.at(-1)!;
  f.send(player, 'vote', { pollId: poll.id, option: 'high_line' }); f.send(f.host, 'close_vote', { pollId: poll.id }); f.send(f.host, 'next');
}
function roll(f: ReturnType<typeof fixture>, player: Session, objective: typeof objectives[number]) {
  const room = f.send(f.host, 'open_check', { objective, action: 'Keep everyone safe', backup: 'Use the dry refuge', bonus: 0, creative: 0 });
  const checkId = room.checks.at(-1)!.id;
  f.send(player, 'volunteer', { checkId, willing: true });
  if (f.store.room(f.host.code).checks.at(-1)!.status === 'recruiting') f.send(f.host, 'select_lead', { checkId });
  return f.send(f.host, 'roll', { checkId, die: 20 });
}

test('a full 40-person v1 save recovers 39 new seats without changing historical names, IDs, votes, actions or reflections', () => {
  const f = fixture(2), old: Session[] = [];
  for (let i = 0; i < 39; i++) old.push(f.store.join(f.host.code, `Original ${i}`));
  f.send(f.host, 'role', { memberId: old[0]!.memberId, role: 'gm' });
  execution(f, old[1]!);
  for (const objective of objectives) roll(f, old[1]!, objective);
  let room = f.send(f.host, 'next');
  room = f.send(f.host, 'report', { ...room.report, owner: 'Mira', nextUpdate: 'Tomorrow', statement: 'Historical statement' });
  f.send(f.host, 'next');
  f.send(old[1]!, 'reflection', { prompt: '0', text: 'We checked the indicator timestamp.' });
  f.send(f.host, 'reflection', { prompt: '1', text: 'Original host reflection' });
  f.send(f.host, 'notes', { text: 'PRIVATE HISTORY' });
  const original = f.store.room(f.host.code);
  const v1 = { ...f.store.export(original), version: 1, room: { ...original } };
  // A real legacy file has no archivedMembers at all.
  delete (v1.room as Partial<Room>).archivedMembers;
  const restored = f.store.restore(JSON.parse(JSON.stringify(v1)), 'New GM');
  room = f.store.room(restored.code);
  expect(restored.memberId).not.toBe(f.host.memberId);
  expect(room.members).toHaveLength(1); expect(room.members[0]!.role).toBe('gm');
  expect(room.archivedMembers).toHaveLength(40);
  expect(room.archivedMembers.every(m => !('role' in m))).toBeTrue();
  expect(room.checks).toEqual(original.checks); expect(room.polls).toEqual(original.polls);
  expect(room.reflections).toEqual(original.reflections);
  expect(room.logs.slice(0, original.logs.length)).toEqual(original.logs);
  expect(memberName(room, f.host.memberId)).toBe('Original GM');
  expect(memberName(room, old[1]!.memberId)).toBe('Original 1');
  expect(memberById(room, old[1]!.memberId)?.id).toBe(old[1]!.memberId);
  for (const previous of [f.host, ...old]) expect(() => f.store.authenticate(restored.code, previous.token)).toThrow('session is invalid');
  expect(() => f.send(restored, 'role', { memberId: old[0]!.memberId, role: 'gm' })).toThrow('Member not found');
  const fresh: Session[] = [];
  for (let i = 0; i < 39; i++) fresh.push(f.store.join(restored.code, `New ${i}`));
  expect(() => f.store.join(restored.code, 'Forty-first')).toThrow('40-person limit');
  f.send(restored, 'role', { memberId: fresh[0]!.memberId, role: 'gm' });
  f.send(fresh[0]!, 'notes', { text: 'New GM continues the room' });
  const view = f.store.view(f.store.room(restored.code), fresh[1]!.memberId, []);
  expect(view.gmNotes).toBeUndefined(); expect(memberName(view, old[1]!.memberId)).toBe('Original 1');
  f.send(fresh[1]!, 'reflection', { prompt: '2', text: 'New player reflection' });

  let previous = restored;
  for (let i = 0; i < 3; i++) {
    const archive = f.store.export(f.store.room(previous.code));
    expect(archive.version).toBe(2); expect(validateArchive(archive).members.length).toBeLessThanOrEqual(40);
    const next = f.store.restore(JSON.parse(stringifyArchive(archive)), `Again ${i}`);
    const state = f.store.room(next.code);
    expect(state.members).toHaveLength(1);
    expect(state.reflections[old[1]!.memberId]?.['0']).toBe('We checked the indicator timestamp.');
    expect(state.reflections[fresh[1]!.memberId]?.['2']).toBe('New player reflection');
    expect(memberName(state, f.host.memberId)).toBe('Original GM');
    expect(state.checks).toEqual(original.checks); expect(state.polls).toEqual(original.polls);
    expect(() => f.store.authenticate(next.code, previous.token)).toThrow();
    f.store.join(next.code, `Fresh ${i}`);
    previous = next;
  }
});

test('restored pending recruitment can continue with new active players and GMs; archives never enter new recruitment or voting', () => {
  const f = fixture(2), oldGM = f.store.join(f.host.code, 'Old Co-GM'), oldPlayer = f.store.join(f.host.code, 'Old player');
  f.send(f.host, 'role', { memberId: oldGM.memberId, role: 'gm' }); execution(f, oldPlayer);
  roll(f, oldPlayer, 'access');
  let room = f.send(f.host, 'open_check', { objective: 'evacuation', action: 'Evacuate', backup: 'Refuge', bonus: 0, creative: 0 });
  const oldCheckId = room.checks.at(-1)!.id;
  f.send(oldPlayer, 'volunteer', { checkId: oldCheckId, willing: true });
  const restored = f.store.restore(f.store.export(f.store.room(f.host.code)), 'Recovered');
  const newGM = f.store.join(restored.code, 'New Co-GM'), newPlayer = f.store.join(restored.code, 'New player');
  f.send(restored, 'role', { memberId: newGM.memberId, role: 'gm' });
  room = f.send(newGM, 'recruit_again', { checkId: oldCheckId });
  const check = room.checks.at(-1)!;
  expect(check.id).not.toBe(oldCheckId); expect(check.eligible).toEqual([newPlayer.memberId]);
  f.send(newPlayer, 'volunteer', { checkId: check.id, willing: true });
  room = f.send(newGM, 'roll', { checkId: check.id, die: 1 });
  expect(room.checks[0]!.leadId).toBe(oldPlayer.memberId);
  const poll = room.polls.at(-1)!;
  expect(poll.eligible).toEqual([newPlayer.memberId]);
  expect(poll.eligible).not.toContain(oldPlayer.memberId);
  expect(() => f.store.authenticate(restored.code, oldGM.token)).toThrow();
  f.send(newPlayer, 'vote', { pollId: poll.id, option: 'keep' }); f.send(newGM, 'close_vote', { pollId: poll.id });
  expect(validateArchive(f.store.export(f.store.room(restored.code))).checks).toHaveLength(2);
});

test('old SQLite JSON without archivedMembers still authenticates and exports v2, while malformed identity collisions are rejected', () => {
  const f = fixture(), original = f.store.room(f.host.code);
  delete (original as Partial<Room>).archivedMembers;
  f.store.db.query('UPDATE rooms SET state=? WHERE code=?').run(JSON.stringify(original), f.host.code);
  const room = f.store.authenticate(f.host.code, f.host.token).room;
  expect(room.archivedMembers).toEqual([]);
  expect(f.store.export(room).version).toBe(2);
  const archive = f.store.export(room);
  archive.room.archivedMembers.push({ ...archive.room.members[0]! });
  expect(() => validateArchive(archive)).toThrow('invalid member identities');
});

function httpFixture() {
  const app = createApp({ db: ':memory:', port: 0, hostname: '127.0.0.1' }); cleanup.push(app.stop);
  const base = `http://127.0.0.1:${app.server.port}`;
  const post = (path: string, body: string | ReadableStream<Uint8Array>, session?: Session) => fetch(`${base}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.token}` } : {}) }, body
  });
  return { app, base, post };
}
function logs(room: Room, count: number, text: string) {
  room.logs = Array.from({ length: count }, () => ({ id: crypto.randomUUID(), at: Date.now(), actorId: room.hostId, text: bi(text, text) }));
}

test('real HTTP imports an exported UTF-8 archive larger than the old 1 MiB, including wrapper escapes; ordinary commands remain capped', async () => {
  const f = httpFixture(), host = f.app.store.create('GM', { mode: 'short', gmCount: 1, dice: 'physical' });
  const room = f.app.store.room(host.code);
  logs(room, 700, '证据与通报\\"\n'.repeat(100));
  f.app.store.save(room);
  const response = await fetch(`${f.base}/api/rooms/${host.code}/export`, { headers: { Authorization: `Bearer ${host.token}` } });
  expect(response.status).toBe(200);
  const text = await response.text();
  expect(utf8Bytes(text)).toBeGreaterThan(maxCommandRequestBytes); expect(utf8Bytes(text)).toBeLessThanOrEqual(maxArchiveBytes);
  // One real large snapshot verifies the raised outgoing buffer limit, not overall performance.
  const ws = new WebSocket(f.base.replace('http', 'ws') + '/ws'); cleanup.push(() => ws.close());
  const socketBytes = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Large snapshot timed out')), 3000);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', code: host.code, token: host.token }));
    ws.onmessage = event => { clearTimeout(timer); resolve(utf8Bytes(String(event.data))); };
    ws.onclose = () => { clearTimeout(timer); reject(new Error('Socket closed before its snapshot')); };
  });
  expect(socketBytes).toBeGreaterThan(maxCommandRequestBytes);
  const save = JSON.parse(text), payload = JSON.stringify({ name: '\u0000'.repeat(32), save });
  expect(utf8Bytes(payload)).toBeLessThanOrEqual(maxImportRequestBytes);
  const imported = await f.post('/api/rooms/import', payload); expect(imported.status).toBe(201);
  const result = await imported.json();
  expect(result.state.logs[0].text).toEqual(room.logs[0]!.text);
  const downloaded = await fetch(`${f.base}/api/rooms/${result.session.code}/export`, { headers: { Authorization: `Bearer ${result.session.token}` } });
  expect(downloaded.status).toBe(200);
  expect(validateArchive(await downloaded.json()).archivedMembers).toHaveLength(1);
  // Less than 1 Mi JS characters, more than 1 Mi UTF-8 bytes.
  const oversized = JSON.stringify({ id: crypto.randomUUID(), revision: room.revision, type: 'notes', payload: { text: '界'.repeat(400_000) } });
  expect(oversized.length).toBeLessThan(maxCommandRequestBytes); expect(utf8Bytes(oversized)).toBeGreaterThan(maxCommandRequestBytes);
  const rejected = await f.post(`/api/rooms/${host.code}/commands`, oversized, host);
  expect(rejected.status).toBe(413); expect((await rejected.json()).error).toBe('too_large');
  expect(f.app.store.room(host.code).gmNotes).toBe('');
});

test('real HTTP byte boundaries apply to Content-Length and chunked bodies, with a separate global/import cap', async () => {
  const f = httpFixture();
  const root = JSON.stringify({ name: 'Boundary', settings: { mode: 'short', gmCount: 1, dice: 'physical' } });
  const exactly = root + ' '.repeat(maxCommandRequestBytes - utf8Bytes(root));
  expect((await f.post('/api/rooms', exactly)).status).toBe(201);
  expect((await f.post('/api/rooms', exactly + ' ')).status).toBe(413);
  const encoded = new TextEncoder().encode('界'.repeat(400_000));
  const stream = new ReadableStream<Uint8Array>({ start(controller) {
    controller.enqueue(encoded.subarray(0, 600_000)); controller.enqueue(encoded.subarray(600_000)); controller.close();
  } });
  expect((await f.post('/api/rooms', stream)).status).toBe(413);
  // A valid import envelope, padded to the larger exact request boundary.
  const host = f.app.store.create('Original', { mode: 'short', gmCount: 1, dice: 'physical' });
  const payload = JSON.stringify({ name: 'Recovered', save: f.app.store.export(f.app.store.room(host.code)) });
  const atImportLimit = payload + ' '.repeat(maxImportRequestBytes - utf8Bytes(payload));
  expect((await f.post('/api/rooms/import', atImportLimit)).status).toBe(201);
  expect((await f.post('/api/rooms/import', atImportLimit + ' ')).status).toBe(413);
  const oversizedStream = new ReadableStream<Uint8Array>({ start(controller) {
    controller.enqueue(new TextEncoder().encode(atImportLimit)); controller.enqueue(new Uint8Array([32])); controller.close();
  } });
  expect((await f.post('/api/rooms/import', oversizedStream)).status).toBe(413);
  const unicodeChunk = new TextEncoder().encode('界'.repeat(4096));
  const chunks = Math.floor(maxImportRequestBytes / unicodeChunk.byteLength) + 1;
  expect(chunks * 4096).toBeLessThan(maxImportRequestBytes);
  const utf8Stream = new ReadableStream<Uint8Array>({ start(controller) {
    for (let i = 0; i < chunks; i++) controller.enqueue(unicodeChunk);
    controller.close();
  } });
  expect((await f.post('/api/rooms/import', utf8Stream)).status).toBe(413);
}, 15_000);

test('native archives reserve recovery metadata even at the byte boundary and pure repeated imports do not grow history', () => {
  const f = fixture(), room = f.store.room(f.host.code), worstName = '\u0000'.repeat(32);
  logs(room, 1000, '');
  const original = f.store.export(room);
  const recovered = f.store.restore(original, worstName);
  const model = f.store.room(recovered.code);
  model.createdAt = Number.MIN_SAFE_INTEGER; model.members[0]!.joinedAt = Number.MIN_SAFE_INTEGER; model.recovery!.at = Number.MIN_SAFE_INTEGER;
  const envelope = { ...original, exportedAt: '+010000-01-01T00:00:00.000Z', room: model };
  const clockReserve = 23; // maximum number width (24) minus the current elapsed "0".
  const overhead = utf8Bytes(stringifyArchive(envelope));
  const count = Math.floor((maxArchiveBytes - overhead - clockReserve) / 12_000);
  for (const candidate of [room, model]) for (const entry of candidate.logs) entry.text = bi('\u0000'.repeat(count), '\u0000'.repeat(count));
  const remaining = maxArchiveBytes - clockReserve - utf8Bytes(stringifyArchive(envelope));
  const padding = '\u0000'.repeat(Math.floor(remaining / 6)) + 'x'.repeat(remaining % 6);
  expect(padding.length).toBeLessThanOrEqual(8000); room.gmNotes = padding; model.gmNotes = padding;
  expect(utf8Bytes(stringifyArchive(envelope)) + clockReserve).toBe(maxArchiveBytes);
  f.store.save(room);
  let archive = f.store.export(f.store.room(f.host.code));
  for (let i = 0; i < 3; i++) {
    const next = f.store.restore(archive, worstName), state = f.store.room(next.code);
    expect(state.archivedMembers).toHaveLength(1); expect(state.logs).toEqual(room.logs);
    expect(state.members[0]!.recoverySeat).toBe(true); expect(state.recovery?.ownerId).toBe(next.memberId);
    archive = f.store.export(state);
    expect(utf8Bytes(stringifyArchive(archive))).toBeLessThanOrEqual(maxArchiveBytes);
    expect(validateArchive(archive).gmNotes).toBe(padding);
  }
}, 15_000);

test('a recovery owner who acts is archived on the next import, even without authored logs', () => {
  const f = fixture();
  const restored = f.store.restore(f.store.export(f.store.room(f.host.code)), 'Recovered owner');
  expect(f.store.room(restored.code).members[0]!.recoverySeat).toBe(true);
  f.send(restored, 'profile', { name: 'Participating GM', character: 'medic' });
  expect(f.store.room(restored.code).members[0]!.recoverySeat).toBeUndefined();
  const next = f.store.restore(f.store.export(f.store.room(restored.code)), 'Next');
  expect(memberName(f.store.room(next.code), restored.memberId)).toBe('Participating GM');
});

test('all persistent writes enforce the complete pretty-JSON byte budget atomically, without deleting historical text', () => {
  const f = fixture(), room = f.store.room(f.host.code);
  // Control characters expand sixfold in JSON. This is well below the limit by string length only.
  logs(room, 1000, '');
  const overhead = utf8Bytes(stringifyArchive(f.store.export(room)));
  const repeats = Math.floor((maxArchiveBytes - overhead - 20_000) / 12_000);
  for (const entry of room.logs) entry.text = bi('\u0000'.repeat(repeats), '\u0000'.repeat(repeats));
  const size = utf8Bytes(stringifyArchive(f.store.export(room)));
  expect(size).toBeLessThan(maxArchiveBytes); expect(size).toBeGreaterThan(32_000_000);
  // Tune gmNotes to leave less than one max-sized notes command of headroom.
  const remaining = maxArchiveBytes - size;
  room.gmNotes = '\u0000'.repeat(Math.max(0, Math.floor((remaining - 3000) / 6)));
  // The data above is a legal archive, including every log's individual text limit.
  expect(room.gmNotes.length).toBeLessThanOrEqual(8000);
  f.store.save(room);
  const before = f.store.room(f.host.code), id = crypto.randomUUID();
  let fault: unknown;
  try { f.send(f.host, 'notes', { text: '\u0000'.repeat(8000) }, id); } catch (error) { fault = error; }
  expect(fault).toBeInstanceOf(GameFault); expect((fault as GameFault).code).toBe('archive_too_large');
  expect(f.store.room(f.host.code)).toEqual(before);
  expect(f.store.db.query('SELECT 1 FROM commands WHERE command_id=?').get(id)).toBeNull();
  // Rejected commands do not claim IDs: retry the same ID with a fitting input.
  f.send(f.host, 'notes', { text: 'fits' }, id);
  const exported = f.store.export(f.store.room(f.host.code));
  expect(utf8Bytes(stringifyArchive(exported))).toBeLessThanOrEqual(maxArchiveBytes);
  expect(validateArchive(exported).logs[0]!.text).toEqual(room.logs[0]!.text);
  const recovered = f.store.restore(exported, 'Restored');
  expect(f.store.room(recovered.code).logs[0]!.text).toEqual(room.logs[0]!.text);

  const huge = f.store.room(f.host.code); huge.gmNotes = '\u0000'.repeat(8000);
  const rowsBefore = f.store.db.query('SELECT COUNT(*) AS n FROM rooms').get();
  const sessionsBefore = f.store.db.query('SELECT COUNT(*) AS n FROM sessions').get();
  expect(() => f.store.save(huge)).toThrow('32 MiB');
  expect(() => f.store.export(huge)).toThrow('32 MiB');
  const input = { ...exported, room: huge };
  expect(() => f.store.restore(input, 'Over limit')).toThrow('32 MiB');
  expect(f.store.db.query('SELECT COUNT(*) AS n FROM rooms').get()).toEqual(rowsBefore);
  expect(f.store.db.query('SELECT COUNT(*) AS n FROM sessions').get()).toEqual(sessionsBefore);
  expect(f.store.room(f.host.code).gmNotes).toBe('fits');
  // Existing pre-budget SQLite JSON must not allow join to persist an oversized state or session.
  f.store.db.query('UPDATE rooms SET state=? WHERE code=?').run(JSON.stringify(huge), f.host.code);
  expect(() => f.store.join(f.host.code, 'No partial membership')).toThrow('32 MiB');
  expect(f.store.room(f.host.code)).toEqual(huge);
  expect(f.store.db.query('SELECT COUNT(*) AS n FROM sessions').get()).toEqual(sessionsBefore);
}, 15_000);
