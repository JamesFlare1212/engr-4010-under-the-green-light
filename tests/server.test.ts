import { test, expect, afterEach } from 'bun:test';
import { createApp } from '../server/index';
import { objectives, type RoomView, type Session } from '../shared/types';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as joinPath } from 'node:path';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });
function fixture() {
  const app = createApp({ db: ':memory:', port: 0, hostname: '127.0.0.1' }); cleanup.push(app.stop);
  const base = `http://127.0.0.1:${app.server.port}`;
  async function api(path: string, payload?: unknown, s?: Session) {
    const response = await fetch(`${base}${path}`, { method: payload === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(s ? { Authorization: `Bearer ${s.token}` } : {}) }, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) });
    return { status: response.status, data: await response.json() };
  }
  async function create(mode: 'full' | 'short' = 'short', dice: 'physical' | 'virtual' = 'physical', gmCount = 1) {
    const result = await api('/api/rooms', { name: 'GM', settings: { mode, dice, gmCount } }); expect(result.status).toBe(201); return result.data.session as Session;
  }
  async function join(host: Session, name: string) { const result = await api(`/api/rooms/${host.code}/join`, { name }); expect(result.status).toBe(201); return result.data.session as Session; }
  async function state(s: Session) { return (await api(`/api/rooms/${s.code}`, undefined, s)).data.state as RoomView; }
  async function send(s: Session, type: string, payload: Record<string, unknown> = {}, revision?: number, id = crypto.randomUUID()) {
    return api(`/api/rooms/${s.code}/commands`, { id, revision: revision ?? (await state(s)).revision, type, payload }, s);
  }
  return { app, base, api, create, join, state, send };
}
function socket(base: string, session: Session) {
  const ws = new WebSocket(base.replace('http', 'ws') + '/ws');
  const states: RoomView[] = [];
  const waiters = new Set<() => void>();
  ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', code: session.code, token: session.token }));
  ws.onmessage = event => { const message = JSON.parse(String(event.data)); if (message.type === 'state') { states.push(message.state); waiters.forEach(check => check()); } };
  const until = (predicate: (state: RoomView) => boolean) => new Promise<RoomView>((resolve, reject) => {
    const timer = setTimeout(() => { waiters.delete(check); reject(new Error('WebSocket state timed out')); }, 3000);
    const check = () => { const found = [...states].reverse().find(predicate); if (found) { clearTimeout(timer); waiters.delete(check); resolve(found); } };
    waiters.add(check); check();
  });
  cleanup.push(() => ws.close());
  return { ws, states, until };
}
test('real WebSocket: authenticated projections, presence across tabs and reconnection preserve identity', async () => {
  const f = fixture(), host = await f.create(), p = await f.join(host, 'Player');
  const gmSocket = socket(f.base, host), playerSocket = socket(f.base, p);
  const snapshot = await playerSocket.until(s => s.online.includes(p.memberId)); expect(snapshot.gmNotes).toBeUndefined(); expect(snapshot.members).toHaveLength(2);
  await gmSocket.until(s => s.online.includes(p.memberId));
  const secondTab = socket(f.base, p); await secondTab.until(s => s.online.includes(p.memberId));
  playerSocket.ws.close();
  await f.send(host, 'next'); const next = await secondTab.until(s => s.phase === 'briefing'); expect(next.online.filter(i => i === p.memberId)).toHaveLength(1);
  secondTab.ws.close(); await gmSocket.until(s => s.phase === 'briefing' && !s.online.includes(p.memberId));
  const reconnected = socket(f.base, p); const restored = await reconnected.until(s => s.phase === 'briefing'); expect(restored.me).toBe(p.memberId); expect(restored.members).toHaveLength(2);
});
test('HTTP sync: players can vote at the same revision while concurrent GM actions return 409 with the latest state', async () => {
  const f = fixture(), host = await f.create('short', 'physical', 2), gm2 = await f.join(host, 'Co-GM'), a = await f.join(host, 'A'), b = await f.join(host, 'B');
  await f.send(host, 'role', { memberId: gm2.memberId, role: 'gm' });
  const version = (await f.state(host)).revision;
  const results = await Promise.all([f.send(host, 'next', {}, version), f.send(gm2, 'next', {}, version)]);
  expect(results.map(r => r.status).sort()).toEqual([200, 409]); expect(results.find(r => r.status === 409)!.data.state.phase).toBe('briefing');
  await f.send(host, 'next'); await f.send(host, 'next'); const state = await f.state(host), poll = state.polls.at(-1)!;
  await f.send(a, 'vote', { pollId: poll.id, option: 'both' }, state.revision);
  const hidden = await f.state(b); expect(hidden.polls.at(-1)!.myVote).toBeNull(); expect(hidden.polls.at(-1)!.counts).toBeNull();
  await f.send(b, 'vote', { pollId: poll.id, option: 'both' }, state.revision);
  const allVoted = (await f.state(host)).polls.at(-1)!;
  expect(allVoted.status).toBe('open'); expect(allVoted.voted).toHaveLength(2); expect(allVoted.counts).toBeNull();
  expect((await f.send(a, 'vote', { pollId: poll.id, option: 'verify' }, state.revision)).status).toBe(200);
  expect((await f.send(b, 'vote', { pollId: poll.id, option: 'verify' }, state.revision)).status).toBe(200);
  expect((await f.state(a)).polls.at(-1)!.myVote).toBe('verify');
  expect((await f.send(a, 'close_vote', { pollId: poll.id })).status).toBe(403);
  const closeRevision = (await f.state(host)).revision;
  const closed = await Promise.all([f.send(host, 'close_vote', { pollId: poll.id }, closeRevision), f.send(gm2, 'close_vote', { pollId: poll.id }, closeRevision)]);
  expect(closed.map(r => r.status).sort()).toEqual([200, 409]);
  expect((await f.state(host)).polls.at(-1)!.counts).toMatchObject({ both: 0, verify: 2 });
  expect((await f.send(a, 'vote', { pollId: poll.id, option: 'both' })).status).toBe(400);
});
test('full HTTP playthrough: six rotating leads, three execution checks, automatic remediation votes, handover and debrief', async () => {
  const f = fixture(), host = await f.create('full'), players: Session[] = [];
  for (let i = 0; i < 6; i++) players.push(await f.join(host, `Player ${i}`));
  async function send(type: string, payload: Record<string, unknown> = {}) { const result = await f.send(host, type, payload); expect(result.status).toBe(200); return result.data.state as RoomView; }
  async function allVote(option: string) {
    const s = await f.state(host), pollId = s.polls.at(-1)!.id;
    const results = await Promise.all(players.map(p => f.send(p, 'vote', { pollId, option }, s.revision))); expect(results.every(r => r.status === 200)).toBeTrue();
    expect((await f.state(host)).polls.at(-1)!.status).toBe('open');
    await send('close_vote', { pollId });
  }
  async function roll(objective: typeof objectives[number], lead: number, die: number) {
    const s = await send('open_check', { objective, action: 'Our action', backup: 'Our contingency', bonus: 2, creative: 0 }); const checkId = s.checks.at(-1)!.id;
    const responses = await Promise.all(players.map((p, i) => f.send(p, 'volunteer', { checkId, willing: i === lead }, s.revision))); expect(responses.every(r => r.status === 200)).toBeTrue();
    expect((await f.state(host)).checks.at(-1)!.leadId).toBe(players[lead]!.memberId);
    return send('roll', { checkId, die });
  }
  await send('next'); await send('next');
  for (let i = 0; i < 3; i++) await roll(objectives[i]!, i, 10);
  await send('next'); await allVote('both'); await send('next'); await allVote('high_line'); await send('next');
  await roll('access', 3, 5); await allVote('spend'); await roll('evacuation', 4, 10); await roll('isolation', 5, 1); await allVote('keep');
  let s = await send('next'); expect(s.phase).toBe('ending'); expect(s.emergencyKits).toBe(1); expect(s.members.filter(m => m.role === 'player').every(m => m.leads === 1)).toBeTrue();
  s = await send('report_preset', { locale: 'en' });
  await send('report', { ...s.report, owner: 'Mira', nextUpdate: 'After the next mechanical verification', truthfulness: 'accurate' });
  await send('next'); const reflection = await f.send(players[0]!, 'reflection', { prompt: '0', text: 'We trusted the old indicator before checking its timestamp.' }); expect(reflection.status).toBe(200);
  const save = await f.api(`/api/rooms/${host.code}/export`, undefined, host); expect(save.status).toBe(200); expect(save.data.room.phase).toBe('debrief');
  const restored = await f.api('/api/rooms/import', { name: 'Restored GM', save: save.data }); expect(restored.status).toBe(201); expect(restored.data.state.checks).toHaveLength(6); expect(restored.data.state.emergencyKits).toBe(1);
});
test('permissions and input: reject unauthenticated access, player exports, cross-origin requests and invalid JSON', async () => {
  const f = fixture(), host = await f.create(), p = await f.join(host, 'Player');
  expect((await f.api(`/api/rooms/${host.code}`)).status).toBe(401); expect((await f.api(`/api/rooms/${host.code}/export`, undefined, p)).status).toBe(403);
  const badOrigin = await fetch(`${f.base}/api/rooms`, { method: 'POST', headers: { Origin: 'https://unrelated.example' }, body: '{}' }); expect(badOrigin.status).toBe(403);
  const badJson = await fetch(`${f.base}/api/rooms`, { method: 'POST', body: '{oops' }); expect(badJson.status).toBe(400);
  const wrongCode = await f.api('/api/rooms/0000/join', { name: 'Visitor' }); expect(wrongCode.status).toBe(404);
});
test('origin validation works without Fetch Metadata and rejects forged metadata and invalid origins with 403', async () => {
  const f = fixture();
  for (const origin of ['https://unrelated.example', 'null', 'not-a-url', 'file:///tmp']) {
    const response = await fetch(`${f.base}/api/rooms`, {
      method: 'POST', headers: { Origin: origin, 'Sec-Fetch-Site': 'same-origin' }, body: '{}'
    });
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe('origin');
  }
});
test('WebSocket rejects invalid tokens and sends no room content before authentication', async () => {
  const f = fixture(), host = await f.create(); const messages: string[] = [];
  const ws = new WebSocket(f.base.replace('http', 'ws') + '/ws'); cleanup.push(() => ws.close());
  const closed = new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Expected auth rejection')), 2000);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', code: host.code, token: 'invalid-token-that-is-long-enough-to-pass-validation' }));
    ws.onmessage = event => messages.push(String(event.data));
    ws.onclose = event => { clearTimeout(timer); resolve(event.code); };
  });
  expect(await closed).toBe(1008); expect(messages).toHaveLength(0);
});
test('production assets: deep room links serve the app, private source files stay inaccessible and CSP allows bundled fonts', async () => {
  const directory = mkdtempSync(joinPath(tmpdir(), 'green-light-static-')); cleanup.push(() => rmSync(directory, { recursive: true, force: true }));
  const publicPath = joinPath(directory, 'web'); mkdirSync(publicPath); writeFileSync(joinPath(publicPath, 'index.html'), '<!doctype html><title>Public application</title>');
  writeFileSync(joinPath(directory, 'private.ts'), 'PRIVATE SOURCE');
  const app = createApp({ db: ':memory:', port: 0, hostname: '127.0.0.1', staticDir: publicPath }); cleanup.push(app.stop);
  const base = `http://127.0.0.1:${app.server.port}`;
  const deep = await fetch(`${base}/room/1234`); expect(deep.status).toBe(200); expect(await deep.text()).toContain('Public application');
  expect(deep.headers.get('Content-Security-Policy')).toContain("font-src 'self' data:");
  const source = await fetch(`${base}/server/private.ts`); expect(source.status).toBe(404); expect(await source.text()).not.toContain('PRIVATE SOURCE');
});

test('collaborative handover: player and observer saves sync to everyone and incomplete drafts can be saved', async () => {
  const f = fixture(), host = await f.create(), player = await f.join(host, 'Player'), observer = await f.join(host, 'Observer');
  await f.send(host, 'role', { memberId: observer.memberId, role: 'spectator' });
  const room = f.app.store.room(host.code); room.phase = 'ending'; room.gmNotes = 'Private notes'; f.app.store.save(room);
  const gmSocket = socket(f.base, host), playerSocket = socket(f.base, player), observerSocket = socket(f.base, observer);
  await observerSocket.until(s => s.phase === 'ending');
  const partial = await f.send(player, 'report', { ...room.report, observations: 'Count verified by the team' });
  expect(partial.status).toBe(200); expect(partial.data.state.report.statement).toBe('');
  await gmSocket.until(s => s.report.observations === 'Count verified by the team');
  expect((await f.send(host, 'next')).status).toBe(400);
  const preset = await f.send(observer, 'report_preset', { locale: 'en' }); expect(preset.status).toBe(200);
  const saved = await f.send(observer, 'report', { ...preset.data.state.report, owner: 'Mira', nextUpdate: 'After verification', statement: 'Our actual public statement' });
  expect(saved.status).toBe(200);
  const shared = await playerSocket.until(s => s.report.owner === 'Mira');
  expect(shared.report.statement).toBe('Our actual public statement'); expect(shared.gmNotes).toBeUndefined();
  const unauthenticated = await f.api(`/api/rooms/${host.code}/commands`, { id: crypto.randomUUID(), revision: shared.revision, type: 'report', payload: shared.report });
  expect(unauthenticated.status).toBe(401);
});
