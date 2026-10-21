import { type ServerWebSocket } from 'bun';
import { resolve, extname } from 'node:path';
import { z } from 'zod';
import { Store, commandSchema } from './store';
import { GameFault, parse, requireThat, settingsSchema, nameSchema } from './engine';
import { bi } from '../shared/types';

interface SocketData { code: string; memberId: string; token: string; lastSeen: number; authenticated: boolean }
export function createApp(options: { db?: string; port?: number; hostname?: string; staticDir?: string } = {}) {
  const store = new Store(options.db ?? process.env.DATABASE_PATH ?? './data/green-light.sqlite');
  const clients = new Set<ServerWebSocket<SocketData>>();
  let stopped = false;
  const rates = new Map<string, { start: number; count: number }>();
  const staticDir = resolve(options.staticDir ?? 'dist');
  function online(code: string) { return [...new Set([...clients].filter(ws => ws.data.authenticated && ws.data.code === code).map(ws => ws.data.memberId))]; }
  function broadcast(code: string) {
    if (stopped) return;
    const room = store.room(code); const present = online(code);
    for (const ws of clients) if (ws.data.authenticated && ws.data.code === code) {
      ws.send(JSON.stringify({ type: 'state', state: store.view(room, ws.data.memberId, present) }));
    }
  }
  const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' } });
  function rate(key: string, max: number) {
    let entry = rates.get(key);
    if (!entry || Date.now() - entry.start > 60_000) { entry = { start: Date.now(), count: 0 }; rates.set(key, entry); }
    requireThat(++entry.count <= max, '操作过于频繁，请稍后重试。', 'Too many requests. Try again shortly.', 'rate_limit', 429);
  }
  async function body(req: Request) {
    const raw = await req.text();
    requireThat(raw.length <= 1_048_576, '请求内容过大。', 'Request too large.', 'too_large', 413);
    try { return JSON.parse(raw); } catch { throw new GameFault('json', bi('请求不是有效的 JSON。', 'Request body is not valid JSON.')); }
  }
  const bearer = (req: Request) => (req.headers.get('authorization') ?? '').replace(/^Bearer /, '');
  function sameOrigin(req: Request) {
    const origin = req.headers.get('origin');
    if (!origin) return;
    let originHost: string | undefined;
    try {
      const parsed = new URL(origin);
      if (['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password && parsed.pathname === '/' && !parsed.search && !parsed.hash) originHost = parsed.host;
    } catch { /* Invalid origins return 403, just like other mismatched origins. */ }
    // Preserving Host through the proxy enables validation without Sec-Fetch-Site, which LAN HTTP may omit.
    requireThat(originHost && (originHost === new URL(req.url).host || origin === process.env.PUBLIC_ORIGIN), '请求来源与房间地址不一致。', 'The request origin does not match this room address.', 'origin', 403);
  }
  const server = Bun.serve<SocketData>({
    port: options.port ?? Number(process.env.PORT ?? 3000), hostname: options.hostname ?? '0.0.0.0', maxRequestBodySize: 1_048_576,
    async fetch(req, bunServer) {
      const url = new URL(req.url);
      try {
        if (url.pathname === '/api/health') return json({ ok: Boolean(store.db.query('SELECT 1').get()), schemaVersion: 1 });
        if (url.pathname === '/ws') {
          sameOrigin(req);
          rate(`ws:${bunServer.requestIP(req)?.address ?? 'local'}`, 120);
          if (bunServer.upgrade(req, { data: { code: '', memberId: '', token: '', lastSeen: Date.now(), authenticated: false } })) return;
          return json({ error: 'upgrade_required' }, 426);
        }
        if (req.method === 'POST') sameOrigin(req);
        if (url.pathname === '/api/rooms' && req.method === 'POST') {
          rate(`create:${bunServer.requestIP(req)?.address ?? 'local'}`, 15);
          const data = parse(z.object({ name: nameSchema, settings: settingsSchema }), await body(req));
          const session = store.create(data.name, data.settings);
          return json({ session, state: store.view(store.room(session.code), session.memberId, []) }, 201);
        }
        if (url.pathname === '/api/rooms/import' && req.method === 'POST') {
          rate(`create:${bunServer.requestIP(req)?.address ?? 'local'}`, 15);
          const data = parse(z.object({ name: nameSchema, save: z.unknown() }), await body(req));
          const session = store.restore(data.save, data.name);
          return json({ session, state: store.view(store.room(session.code), session.memberId, []) }, 201);
        }
        const match = /^\/api\/rooms\/(\d{4})(?:\/(join|commands|export))?$/.exec(url.pathname);
        if (match) {
          const [, code, action] = match;
          if (action === 'join' && req.method === 'POST') {
            rate(`join:${bunServer.requestIP(req)?.address ?? 'local'}`, 60);
            const data = parse(z.object({ name: nameSchema }), await body(req));
            const session = store.join(code, data.name); broadcast(code);
            return json({ session, state: store.view(store.room(code), session.memberId, online(code)) }, 201);
          }
          const token = bearer(req);
          const { room, member } = store.authenticate(code, token);
          if (!action && req.method === 'GET') return json({ state: store.view(room, member.id, online(code)) });
          if (action === 'export' && req.method === 'GET') {
            requireThat(member.role === 'gm', '只有 GM 可以导出含主持笔记的完整存档。', 'Only a GM may export a full save containing private notes.', 'forbidden', 403);
            return new Response(JSON.stringify(store.export(room), null, 2), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Content-Disposition': `attachment; filename="green-light-${code}.json"` } });
          }
          if (action === 'commands' && req.method === 'POST') {
            rate(`commands:${member.id}`, 180);
            const command = parse(commandSchema, await body(req));
            try {
              const updated = store.command(code, token, command); broadcast(code);
              return json({ state: store.view(updated, member.id, online(code)) });
            } catch (error) {
              if (error instanceof GameFault && error.code === 'conflict') return json({ error: error.code, message: error.messageText, state: store.view(store.room(code), member.id, online(code)) }, 409);
              throw error;
            }
          }
          return json({ error: 'method_not_allowed', message: bi('不支持此请求方式。', 'Method not allowed.') }, 405);
        }
        if (url.pathname.startsWith('/api/')) return json({ error: 'not_found', message: bi('接口不存在。', 'Endpoint not found.') }, 404);
        if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
        const decoded = decodeURIComponent(url.pathname);
        const filePath = resolve(staticDir, `.${decoded}`);
        requireThat(filePath.startsWith(`${staticDir}/`) || filePath === staticDir, '路径无效。', 'Invalid path.', 'path', 400);
        let file = Bun.file(filePath);
        if (!extname(filePath) || !(await file.exists())) {
          if (extname(filePath) && extname(filePath) !== '.html') return new Response('Not found', { status: 404 });
          file = Bun.file(resolve(staticDir, 'index.html'));
        }
        if (!(await file.exists())) return new Response('Run bun run build, or use bun run dev on port 5173.', { status: 503 });
        return new Response(req.method === 'HEAD' ? null : file, { headers: {
          'Content-Type': file.type,
          'Cache-Control': decoded.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
          'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
          'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
          'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
        } });
      } catch (error) {
        if (error instanceof GameFault) return json({ error: error.code, message: error.messageText }, error.status);
        console.error('Request failed:', error instanceof Error ? error.message : 'Unknown error');
        return json({ error: 'internal', message: bi('服务暂时出错，请重试；已保存的进度仍在。', 'A server error occurred. Try again; saved progress is retained.') }, 500);
      }
    },
    websocket: {
      maxPayloadLength: 4096, idleTimeout: 40, backpressureLimit: 1_048_576, closeOnBackpressureLimit: true,
      open(ws) { clients.add(ws); },
      message(ws, message) {
        try {
          ws.data.lastSeen = Date.now();
          const data = JSON.parse(String(message));
          if (!ws.data.authenticated) {
            const auth = parse(z.object({ type: z.literal('auth'), code: z.string().regex(/^\d{4}$/), token: z.string().min(40).max(200) }), data);
            const { member } = store.authenticate(auth.code, auth.token);
            Object.assign(ws.data, { code: auth.code, memberId: member.id, token: auth.token, authenticated: true });
            broadcast(auth.code);
          } else if (data.type === 'ping') ws.send(JSON.stringify({ type: 'pong', at: Date.now() }));
        } catch { ws.close(1008, 'Invalid session'); }
      },
      close(ws) { clients.delete(ws); if (ws.data.authenticated) broadcast(ws.data.code); }
    }
  });
  const sweep = setInterval(() => {
    for (const ws of clients) if (Date.now() - ws.data.lastSeen > (ws.data.authenticated ? 45_000 : 10_000)) ws.close(1008, 'Heartbeat expired');
    for (const [key, value] of rates) if (Date.now() - value.start > 60_000) rates.delete(key);
  }, 5000);
  sweep.unref();
  return { server, store, broadcast, stop: () => { stopped = true; clearInterval(sweep); for (const ws of clients) ws.close(1001, 'Server stopping'); clients.clear(); server.stop(true); store.db.close(); } };
}
if (import.meta.main) {
  const app = createApp();
  console.log(`Under the Green Light: http://localhost:${app.server.port}`);
  const stop = () => { app.stop(); process.exit(0); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
}
