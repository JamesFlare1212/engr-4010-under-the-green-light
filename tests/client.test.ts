import { beforeAll, expect, test } from 'bun:test';
import { runInNewContext } from 'node:vm';
import { newRoom } from '../server/engine';
import type { RoomView, Session } from '../shared/types';

type Client = typeof import('../src/lib/client');
let bundle = '';
beforeAll(async () => {
  const result = await Bun.build({ entrypoints: [`${import.meta.dir}/fixtures/client-entry.ts`], target: 'browser', format: 'iife' });
  if (!result.success) throw new AggregateError(result.logs, 'Client test bundle failed');
  bundle = await result.outputs[0]!.text();
}, 15_000);
function value<T>(store: { subscribe: (run: (value: T) => void) => () => void }): T {
  let result!: T; const stop = store.subscribe(v => { result = v; }); stop(); return result;
}
const credentials = (code: string): Session => ({ code, token: `token-${code}`, memberId: `member-${code}`, name: 'GM' });
function state(s: Session, revision = 1, online: string[] = []): RoomView {
  const room = newRoom(s.code, 'GM', { mode: 'short', gmCount: 1, dice: 'virtual' });
  room.id = `room-${s.code}`; room.members[0]!.id = s.memberId; room.hostId = s.memberId;
  return { ...room, revision, me: s.memberId, online, polls: [] };
}
async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
function browser(cacheUnavailable = false) {
  let now = 0, nextTimer = 0;
  const timers = new Map<number, { at: number; repeat: number; callback: () => void }>();
  function timeout(callback: () => void, delay = 0, repeat = 0) {
    const id = ++nextTimer; timers.set(id, { at: now + delay, repeat, callback }); return id;
  }
  function advance(ms: number) {
    const end = now + ms;
    for (;;) {
      const entry = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!entry) break;
      const [id, timer] = entry; now = timer.at;
      if (timer.repeat) timer.at += timer.repeat; else timers.delete(id);
      timer.callback();
    }
    now = end;
  }
  const sockets: FakeSocket[] = [];
  class FakeSocket {
    static OPEN = 1;
    readyState = 0;
    onopen: (() => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;
    sent: string[] = [];
    constructor(_url: string) { sockets.push(this); }
    open() { this.readyState = 1; this.onopen?.(); }
    send(message: string) { this.sent.push(message); }
    message(room: RoomView) { this.onmessage?.({ data: JSON.stringify({ type: 'state', state: room }) }); }
    close() { this.readyState = 3; timeout(() => this.onclose?.()); }
  }
  const storage = new Map<string, string>(), writes: { key: string; data: string }[] = [];
  const localStorage = {
    getItem(key: string) { if (cacheUnavailable && key.startsWith('green-light:cache:')) throw new Error('Cache unavailable'); return storage.get(key) ?? null; },
    setItem(key: string, data: string) { if (cacheUnavailable && key.startsWith('green-light:cache:')) throw new Error('Cache unavailable'); storage.set(key, data); writes.push({ key, data }); }
  };
  const window = new EventTarget();
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const requests: { url: string; init: RequestInit; resolve: (response: Response) => void; reject: (error: Error) => void }[] = [];
  const context = {
    window, document, localStorage, navigator: { onLine: true },
    location: { protocol: 'http:', host: 'game.test' }, history: { pushState() {} },
    WebSocket: FakeSocket, crypto, AbortController, console,
    Date: class extends Date { static now() { return now; } },
    Math: Object.assign(Object.create(Math), { random: () => 0 }),
    setTimeout: timeout, clearTimeout: (id: number) => timers.delete(id),
    setInterval: (callback: () => void, delay: number) => timeout(callback, delay, delay), clearInterval: (id: number) => timers.delete(id),
    fetch: (url: string, init: RequestInit) => new Promise<Response>((resolve, reject) => { requests.push({ url, init, resolve, reject }); }),
    testClient: undefined as Client | undefined
  };
  runInNewContext(bundle, context);
  const client = context.testClient!;
  function save(...sessions: Session[]) { localStorage.setItem('green-light:sessions', JSON.stringify(Object.fromEntries(sessions.map(s => [s.code, s])))); }
  async function reply(index: number, data: unknown, status = 200) { requests[index]!.resolve(Response.json(data, { status })); await flush(); }
  async function live(s = credentials('1234')) {
    save(s); await client.resume(s.code); const ws = sockets.at(-1)!; ws.open(); ws.message(state(s)); return { s, ws };
  }
  return { client, sockets, requests, window, document, storage, writes, save, reply, live, advance };
}

test('a delayed initial HTTP response cannot erase presence delivered by the same live socket', async () => {
  const b = browser(), { s } = await b.live();
  b.sockets[0]!.message(state(s, 1, ['live-member']));
  await b.reply(0, { state: state(s, 1, []) });
  expect(value(b.client.room)?.online).toEqual(['live-member']);
  b.document.dispatchEvent(new Event('visibilitychange'));
  await b.reply(1, { state: state(s, 1, ['stale-http-member']) });
  expect(value(b.client.room)?.online).toEqual(['live-member']);
});

test('manual reconnect retains readable state for the same identity even without a usable cache', async () => {
  const b = browser(true), { s } = await b.live(); b.storage.delete(`green-light:cache:${s.code}`);
  await b.client.resume(s.code);
  expect(value(b.client.room)?.me).toBe(s.memberId); expect(value(b.client.connection)).toBe('connecting');
  expect(await b.client.command('clock')).toBe(false);
});

test.each(['join', 'import'] as const)('%s uses its appropriate request deadline instead of aborting a large transfer at 12 seconds', async kind => {
  const b = browser(), pending = b.client.enter(kind, 'GM', kind === 'join' ? '1234' : {});
  b.advance(13_000);
  expect(b.requests[0]!.init.signal?.aborted).toBe(kind === 'join');
  b.requests[0]!.reject(new Error('End controlled request')); expect(await pending).toBe(false);
});

test('archive export also allows the longer transfer deadline', async () => {
  const b = browser(); await b.live(); const pending = b.client.downloadSave();
  b.advance(13_000); expect(b.requests[1]!.init.signal?.aborted).toBe(false);
  b.requests[1]!.reject(new Error('End controlled export')); await pending;
});

test('duplicate snapshots skip store updates while newer states share one delayed cache write', async () => {
  const b = browser(), { s, ws } = await b.live(), current = value(b.client.room)!;
  let updates = 0; const stop = b.client.room.subscribe(() => { updates++; });
  ws.message(structuredClone(current)); expect(updates).toBe(1);
  ws.message({ ...current, revision: 2 }); ws.message({ ...current, revision: 3 }); expect(updates).toBe(3);
  const cached = () => b.writes.filter(write => write.key.startsWith('green-light:cache:'));
  b.advance(249); expect(cached()).toHaveLength(0);
  b.advance(1); expect(cached()).toHaveLength(1);
  expect(JSON.parse(b.storage.get(`green-light:cache:${s.code}`)!).revision).toBe(3); stop();
});

test('hidden, pagehide and disconnect flush the latest accepted snapshot without delayed duplicate writes', async () => {
  const b = browser(), { s, ws } = await b.live(), current = value(b.client.room)!;
  const cached = () => b.writes.filter(write => write.key.startsWith('green-light:cache:'));
  ws.message({ ...current, revision: 2 }); b.document.visibilityState = 'hidden'; b.document.dispatchEvent(new Event('visibilitychange'));
  expect(cached()).toHaveLength(1); b.advance(250); expect(cached()).toHaveLength(1);
  ws.message({ ...current, revision: 3 }); b.window.dispatchEvent(new Event('pagehide'));
  expect(cached()).toHaveLength(2);
  ws.message({ ...current, revision: 4 }); b.client.disconnect(); expect(cached()).toHaveLength(3);
  b.advance(250); expect(cached()).toHaveLength(3);
  expect(JSON.parse(b.storage.get(`green-light:cache:${s.code}`)!).revision).toBe(4);
});

test('a same-code replacement room is not discarded as an old or equal-revision HTTP snapshot', async () => {
  const b = browser(); await b.live(); const current = value(b.client.room)!;
  b.document.dispatchEvent(new Event('visibilitychange'));
  await b.reply(1, { state: { ...current, id: 'replacement-room', online: ['replacement'] } });
  expect(value(b.client.room)?.id).toBe('replacement-room');
  expect(value(b.client.room)?.online).toEqual(['replacement']);
  b.sockets[0]!.message({ ...current, id: 'another-replacement', revision: 0 });
  expect(value(b.client.room)?.revision).toBe(0);
});

test('an old HTTP snapshot cannot overwrite equal-revision presence after reconnecting', async () => {
  const b = browser(), { s } = await b.live();
  await b.client.resume(s.code);
  const fresh = b.sockets.at(-1)!; fresh.open(); fresh.message(state(s, 2, ['fresh-connection']));
  await b.reply(0, { state: state(s, 2, ['old-connection']) });
  expect(value(b.client.room)?.online).toEqual(['fresh-connection']);
});

test('navigating to an unsaved room clears the old identity and ignores its late callbacks', async () => {
  const b = browser(), { s, ws } = await b.live(); const late = ws.onmessage!;
  expect(await b.client.resume('9999')).toBe(false);
  expect(value(b.client.room)).toBeNull(); expect(value(b.client.session)).toBeNull();
  late({ data: JSON.stringify({ type: 'state', state: state(s, 10) }) });
  expect(value(b.client.room)).toBeNull(); expect(value(b.client.connection)).not.toBe('live');
});

test('an abandoned command cannot retry, expire a different session or keep it busy', async () => {
  const b = browser(), { s } = await b.live();
  const pending = b.client.command('clock'); const request = b.requests[1]!;
  const other = credentials('5678'); b.save(s, other); await b.client.resume(other.code);
  b.sockets.at(-1)!.open(); b.sockets.at(-1)!.message(state(other));
  expect(value(b.client.busy)).toBe(false);
  request.reject(new TypeError('Connection lost')); await flush();
  expect(await pending).toBe(false);
  expect(b.requests.filter(r => r.url.includes(s.code) && r.init.method === 'POST')).toHaveLength(1);
  expect(value(b.client.session)?.code).toBe(other.code); expect(value(b.client.connection)).toBe('live');
  expect(value(b.client.notice)).toBeNull();
});

test('a disconnected socket cannot mark a newer connection live or replace its state', async () => {
  const b = browser(), { s, ws } = await b.live(); const late = ws.onmessage!;
  ws.close(); b.advance(700); const next = b.sockets.at(-1)!;
  expect(next).not.toBe(ws); next.open(); next.message(state(s, 2, ['new']));
  late({ data: JSON.stringify({ type: 'state', state: state(s, 2, ['old']) }) });
  expect(value(b.client.room)?.online).toEqual(['new']);
});

test('expired credentials stay terminal across foreground and network events until explicit resume', async () => {
  const b = browser(), { s, ws } = await b.live(); const late = ws.onmessage!;
  await b.reply(0, { message: { 'zh-CN': '失效', en: 'Expired' } }, 401);
  expect(value(b.client.connection)).toBe('expired');
  b.window.dispatchEvent(new Event('online')); b.document.dispatchEvent(new Event('visibilitychange'));
  b.advance(60_000); late({ data: JSON.stringify({ type: 'state', state: state(s, 20) }) });
  expect(b.sockets).toHaveLength(1); expect(value(b.client.connection)).toBe('expired');
  await b.client.resume(s.code); expect(b.sockets).toHaveLength(2);
});

test('network retries reuse the command ID while revision conflicts sync without retrying', async () => {
  const b = browser(), { s } = await b.live();
  const pending = b.client.command('clock'); b.requests[1]!.reject(new TypeError('Lost response')); await flush();
  expect(b.requests[2]!.init.body).toBe(b.requests[1]!.init.body);
  await b.reply(2, { state: state(s, 2) }); expect(await pending).toBe(true);
  const conflict = b.client.command('clock');
  await b.reply(3, { message: { 'zh-CN': '冲突', en: 'Conflict' }, state: state(s, 3) }, 409);
  await b.reply(4, { state: state(s, 3) }); expect(await conflict).toBe(false);
  expect(value(b.client.room)?.revision).toBe(3); expect(value(b.client.busy)).toBe(false);
  expect(b.requests.filter(r => r.init.method === 'POST')).toHaveLength(3);
});
