import { afterEach, expect, test } from 'bun:test';
import { createServer } from 'vite';
import config from '../vite.config';
import { createApp } from '../server/index';
import type { RoomView } from '../shared/types';

const cleanup: (() => unknown)[] = [];
afterEach(async () => { while (cleanup.length) await cleanup.pop()!(); });

async function fixture() {
  const backend = createApp({ db: ':memory:', hostname: '127.0.0.1', port: 0 });
  cleanup.push(backend.stop);
  const target = `http://127.0.0.1:${backend.server.port}`;
  // Use the actual project proxy options with only the temporary backend port changed to catch default Host rewriting in string shorthand.
  const proxy = Object.fromEntries(Object.entries(config.server!.proxy!).map(([path, options]) => [
    path, typeof options === 'string' ? target : { ...options, target: path === '/ws' ? target.replace('http:', 'ws:') : target }
  ]));
  const vite = await createServer({
    configFile: false, logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0, hmr: false, watch: null, proxy }
  });
  cleanup.push(() => vite.close());
  await vite.listen();
  const address = vite.httpServer!.address();
  if (!address || typeof address === 'string') throw new Error('Vite did not bind a test port');
  const base = `http://127.0.0.1:${address.port}`;
  async function post(origin: string, path: string, body: unknown, overrideOrigin = origin) {
    return fetch(`${base}${path}`, {
      method: 'POST',
      // LAN HTTP and some browsers omit Sec-Fetch-Site; it must not mask an incorrectly rewritten Host.
      headers: { Host: new URL(origin).host, Origin: overrideOrigin, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }
  return { base, port: address.port, post };
}

test('real Vite proxy: localhost and LAN requests can create and join rooms without Fetch Metadata', async () => {
  const f = await fixture();
  for (const host of ['localhost', '127.0.0.1', '192.168.10.30', '[fd00::42]']) {
    const origin = `http://${host}:${f.port}`;
    const created = await f.post(origin, '/api/rooms', { name: 'GM', settings: { mode: 'short', gmCount: 1, dice: 'virtual' } });
    expect(created.status).toBe(201);
    const data = await created.json();
    const joined = await f.post(origin, `/api/rooms/${data.session.code}/join`, { name: 'Player' });
    expect(joined.status).toBe(201);
    expect((await joined.json()).state.members).toHaveLength(2);
  }
});

test('real Vite proxy: preserving Origin still rejects cross-origin requests', async () => {
  const f = await fixture();
  const origin = `http://192.168.10.30:${f.port}`;
  for (const wrongOrigin of ['https://unrelated.example', `http://192.168.10.30:${f.port + 1}`]) {
    const response = await f.post(origin, '/api/rooms', {}, wrongOrigin);
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe('origin');
  }
});

test('real Vite WebSocket proxy: LAN origins authenticate and sync without Fetch Metadata', async () => {
  const f = await fixture();
  const origin = `http://192.168.10.30:${f.port}`;
  const created = await f.post(origin, '/api/rooms', { name: 'GM', settings: { mode: 'short', gmCount: 1, dice: 'virtual' } });
  expect(created.status).toBe(201);
  const { session } = await created.json();
  // The shared TypeScript config includes DOM types; use Bun's constructor overload for custom request headers here.
  const BunWebSocket = WebSocket as typeof WebSocket & { new(url: string, options: Bun.WebSocketOptions): WebSocket };
  const socket = new BunWebSocket(`${f.base.replace('http:', 'ws:')}/ws`, { headers: { Host: new URL(origin).host, Origin: origin } });
  cleanup.push(() => socket.close());
  const view = await new Promise<RoomView>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Proxied WebSocket did not authenticate')), 3000);
    socket.onopen = () => socket.send(JSON.stringify({ type: 'auth', code: session.code, token: session.token }));
    socket.onmessage = event => { const message = JSON.parse(String(event.data)); if (message.type === 'state') { clearTimeout(timer); resolve(message.state); } };
    socket.onerror = () => { clearTimeout(timer); reject(new Error('Proxied WebSocket failed')); };
  });
  expect(view.me).toBe(session.memberId);
  expect(view.online).toContain(session.memberId);
});
