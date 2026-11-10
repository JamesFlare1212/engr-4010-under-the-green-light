import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/index';
import { bi, type RoomView } from '../shared/types';

// Loopback transport benchmark; this does not measure browser rendering or WAN latency.
const [members = 12, history = 300, rounds = 5] = process.argv.slice(2, 5).map(Number);
const storage = process.argv[5] ?? 'file';
if (!Number.isInteger(members) || members < 2 || members > 40 || !Number.isInteger(history) || history < 0 || history > 1500 || !Number.isInteger(rounds) || rounds < 1 || rounds > 100 || !['file', 'memory'].includes(storage)) {
  throw new Error('Usage: bun run benchmark:sync [members:2..40] [logs:0..1500] [rounds:1..100] [file|memory]');
}
const directory = mkdtempSync(join(tmpdir(), 'green-light-perf-'));
const app = createApp({ db: storage === 'memory' ? ':memory:' : join(directory, 'game.sqlite'), port: 0, hostname: '127.0.0.1' });
const base = `http://127.0.0.1:${app.server.port}`;
const sockets: WebSocket[] = [];
try {
  const host = app.store.create('GM', { mode: 'short', gmCount: 1, dice: 'physical' });
  const sessions = [host, ...Array.from({ length: members - 1 }, (_, i) => app.store.join(host.code, `Player ${i + 1}`))];
  for (let i = 0; i < 3; i++) app.store.command(host.code, host.token, { id: crypto.randomUUID(), revision: app.store.room(host.code).revision, type: 'next' });
  const room = app.store.room(host.code);
  room.logs = Array.from({ length: history }, (_, i) => ({ id: crypto.randomUUID(), at: Date.now(), actorId: host.memberId, text: bi(`性能测试历史记录 ${i}：团队核对了人员、设备与后续安排。`, `Benchmark history ${i}: the team reviewed people, equipment and follow-up arrangements.`) }));
  app.store.save(room);
  const poll = room.polls.at(-1)!;
  let snapshots = 0, bytes = 0;
  const peers = sessions.map(session => {
    const ws = new WebSocket(`${base.replace('http', 'ws')}/ws`);
    sockets.push(ws);
    let latest: RoomView | undefined;
    let closed = '';
    const waiters = new Set<() => void>();
    ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', code: session.code, token: session.token }));
    ws.onmessage = event => {
      const message = JSON.parse(String(event.data));
      if (message.type !== 'state') return;
      snapshots++; bytes += Buffer.byteLength(String(event.data)); latest = message.state;
      for (const check of waiters) check();
    };
    ws.onclose = event => { closed = `; closed ${event.code}: ${event.reason}`; };
    const until = (predicate: (state: RoomView) => boolean) => new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { waiters.delete(check); reject(new Error(`Sync benchmark timed out; revision ${latest?.revision}, online ${latest?.online.length}${closed}`)); }, 15_000);
      const check = () => { if (latest && predicate(latest)) { clearTimeout(timer); waiters.delete(check); resolve(); } };
      waiters.add(check); check();
    });
    return { until };
  });
  await Promise.all(peers.map(peer => peer.until(state => state.online.length === members)));
  snapshots = 0; bytes = 0;
  let commandTotalMs = 0;
  const execute = app.store.command.bind(app.store);
  app.store.command = (...args) => {
    const started = performance.now();
    try { return execute(...args); } finally { commandTotalMs += performance.now() - started; }
  };
  const responseTimes: number[] = [], syncTimes: number[] = [];
  for (let round = 0; round < rounds; round++) {
    const revision = app.store.room(host.code).revision;
    const started = performance.now();
    const synced = Promise.all(peers.map(peer => peer.until(state => state.revision === revision + members - 1))).then(() => performance.now() - started);
    await Promise.all(sessions.slice(1).map(async session => {
      const sent = performance.now();
      const response = await fetch(`${base}/api/rooms/${host.code}/commands`, {
        method: 'POST', headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: crypto.randomUUID(), revision, type: 'vote', payload: { pollId: poll.id, option: poll.options[round % poll.options.length]!.id } })
      });
      await response.arrayBuffer();
      if (!response.ok) throw new Error(`Command failed: ${response.status}`);
      responseTimes.push(performance.now() - sent);
    }));
    syncTimes.push(await synced);
  }
  const percentile = (values: number[], fraction: number) => Number([...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1]!.toFixed(2));
  console.log(JSON.stringify({ members, history, rounds, storage, commands: (members - 1) * rounds, snapshots, websocketMiB: Number((bytes / 1048576).toFixed(2)), storeCommandTotalMs: Number(commandTotalMs.toFixed(2)), commandP50Ms: percentile(responseTimes, .5), commandP95Ms: percentile(responseTimes, .95), allPeersSyncP50Ms: percentile(syncTimes, .5), allPeersSyncP95Ms: percentile(syncTimes, .95) }, null, 2));
} finally {
  for (const ws of sockets) ws.close();
  app.stop();
  rmSync(directory, { recursive: true, force: true });
}
