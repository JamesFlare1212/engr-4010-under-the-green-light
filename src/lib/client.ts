import { writable, get } from 'svelte/store';
import { bi, type RoomView, type Session, type Text, type Settings, type Command } from '../../shared/types';
import { uuid } from '../../shared/ids';
export const room = writable<RoomView | null>(null);
export const session = writable<Session | null>(null);
export const connection = writable<'connecting' | 'live' | 'offline' | 'expired'>('connecting');
export const busy = writable(false);
export const notice = writable<Text | null>(null);
let socket: WebSocket | null = null;
let reconnect: ReturnType<typeof setTimeout> | undefined;
let heartbeat: ReturnType<typeof setInterval> | undefined;
let fallback: ReturnType<typeof setInterval> | undefined;
let generation = 0;
let attempts = 0;
let lastPong = 0;
export function savedSessions(): Session[] {
  try { return Object.values(JSON.parse(localStorage.getItem('green-light:sessions') ?? '{}')); } catch { return []; }
}
function persist(s: Session) {
  try { localStorage.setItem('green-light:sessions', JSON.stringify(Object.fromEntries([...savedSessions().filter(v => v.code !== s.code), s].map(v => [v.code, v])))); }
  catch { notice.set(bi('浏览器不允许保存登录；请保持此页打开。', 'This browser cannot save your session. Keep this page open.')); }
}
function snapshot(value: RoomView) {
  const current = get(room);
  if (value.code !== get(session)?.code || value.me !== get(session)?.memberId) return;
  if (current && current.code === value.code && current.revision > value.revision) return;
  room.set(value);
  try { localStorage.setItem(`green-light:cache:${value.code}`, JSON.stringify(value)); } catch { /* Network state remains authoritative. */ }
}
class ApiError extends Error { constructor(public status: number, public text: Text) { super(text.en); } }
async function request(path: string, init: RequestInit = {}, timeout = 12_000) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(path, { ...init, signal: controller.signal, headers: { 'Content-Type': 'application/json', ...init.headers } });
    const data = await response.json();
    if (data.state) snapshot(data.state);
    if (!response.ok) throw new ApiError(response.status, data.message ?? bi('请求失败，请稍后重试。', 'Request failed. Try again shortly.'));
    return data;
  } finally { clearTimeout(timer); }
}
function errorNotice(error: unknown) {
  notice.set(error instanceof ApiError ? error.text : bi('暂时无法连接服务。请检查网络后重试，已保存进度会保留。', 'Cannot reach the server. Check your connection and retry. Saved progress is retained.'));
}
export async function enter(kind: 'create' | 'join' | 'import', name: string, data: Settings | string | unknown) {
  busy.set(true); notice.set(null);
  try {
    const path = kind === 'create' ? '/api/rooms' : kind === 'import' ? '/api/rooms/import' : `/api/rooms/${data}/join`;
    const payload = kind === 'create' ? { name, settings: data } : kind === 'import' ? { name, save: data } : { name };
    const result = await request(path, { method: 'POST', body: JSON.stringify(payload) });
    disconnect(); session.set(result.session); persist(result.session); snapshot(result.state);
    history.pushState({}, '', `/room/${result.session.code}`); connect(result.session);
    return true;
  } catch (error) { errorNotice(error); return false; } finally { busy.set(false); }
}
export async function resume(code: string) {
  const saved = savedSessions().find(s => s.code === code);
  if (!saved) return false;
  disconnect(); session.set(saved); connection.set('connecting');
  try {
    const cache = JSON.parse(localStorage.getItem(`green-light:cache:${code}`) ?? 'null');
    if (cache?.me === saved.memberId) snapshot(cache);
  } catch { /* A damaged cache is replaced by the next full snapshot. */ }
  connect(saved); return true;
}
function connect(s: Session) {
  const currentGeneration = generation;
  clearTimeout(reconnect);
  connection.set(navigator.onLine ? 'connecting' : 'offline');
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`);
  socket = ws;
  ws.onopen = () => {
    if (generation !== currentGeneration) return ws.close();
    lastPong = Date.now();
    ws.send(JSON.stringify({ type: 'auth', code: s.code, token: s.token }));
    clearInterval(heartbeat);
    heartbeat = setInterval(() => {
      if (Date.now() - lastPong > 35_000) ws.close();
      else if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
    }, 12_000);
  };
  ws.onmessage = event => {
    if (generation !== currentGeneration) return;
    try {
      const data = JSON.parse(event.data); lastPong = Date.now();
      if (data.type === 'state') { snapshot(data.state); connection.set('live'); attempts = 0; }
    } catch { ws.close(); }
  };
  ws.onclose = () => {
    if (generation !== currentGeneration) return;
    if (get(connection) === 'expired') return;
    clearInterval(heartbeat); connection.set('offline');
    reconnect = setTimeout(() => { if (generation === currentGeneration && get(connection) !== 'expired') connect(s); }, Math.min(10_000, 700 * 2 ** attempts++) + Math.random() * 300);
  };
  ws.onerror = () => ws.close();
  refresh(s);
  if (!fallback) fallback = setInterval(() => { if (get(connection) !== 'live' && get(connection) !== 'expired') refresh(s); }, 7000);
}
async function refresh(s: Session) {
  const currentGeneration = generation;
  try {
    const data = await request(`/api/rooms/${s.code}`, { headers: { Authorization: `Bearer ${s.token}` } });
    if (generation === currentGeneration) snapshot(data.state);
  } catch (error) {
    if (generation === currentGeneration && error instanceof ApiError && error.status === 401) {
      clearTimeout(reconnect); socket?.close(); connection.set('expired'); errorNotice(error);
    }
  }
}
export async function command(type: string, payload: Record<string, unknown> = {}, expectedRevision?: number) {
  const s = get(session), state = get(room);
  if (!s || !state || get(busy)) return false;
  if (get(connection) !== 'live') { notice.set(bi('正在恢复连接，请等到「实时同步」后再操作。', 'Reconnecting. Wait for “Live sync” before taking action.')); return false; }
  busy.set(true); notice.set(null);
  const c: Command = { id: uuid(), revision: expectedRevision ?? state.revision, type, payload };
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await request(`/api/rooms/${s.code}/commands`, { method: 'POST', headers: { Authorization: `Bearer ${s.token}` }, body: JSON.stringify(c) });
        return true;
      } catch (error) { if (error instanceof ApiError || attempt === 1) throw error; }
    }
    return false;
  } catch (error) { errorNotice(error); await refresh(s); return false; } finally { busy.set(false); }
}
export function disconnect() {
  generation++; clearTimeout(reconnect); clearInterval(heartbeat); clearInterval(fallback); fallback = undefined;
  if (socket) { socket.onclose = null; socket.close(); socket = null; }
}
export function leave() {
  disconnect(); room.set(null); session.set(null); history.pushState({}, '', '/');
}
export async function downloadSave() {
  const s = get(session); if (!s) return;
  try {
    const data = await request(`/api/rooms/${s.code}/export`, { headers: { Authorization: `Bearer ${s.token}` } });
    download(JSON.stringify(data, null, 2), `green-light-${s.code}.json`, 'application/json');
  } catch (error) { errorNotice(error); }
}
export function download(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function copyWithSelection(text: string): boolean {
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  // showModal() prevents controls outside the dialog from receiving focus; put the fallback control inside the active dialog.
  const container = previousFocus?.closest('dialog[open]') ?? document.querySelector('dialog[open]') ?? document.body;
  const field = document.createElement('textarea');
  field.value = text;
  field.readOnly = true;
  field.tabIndex = -1;
  field.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;font-size:16px';
  container.appendChild(field);
  try {
    field.focus({ preventScroll: true });
    field.select();
    field.setSelectionRange(0, text.length);
    // execCommand may return true without selecting the intended content; verify the selection first.
    if (document.activeElement !== field || field.selectionStart !== 0 || field.selectionEnd !== text.length) return false;
    return document.execCommand('copy');
  } finally {
    field.remove();
    previousFocus?.focus({ preventScroll: true });
  }
}
export async function copy(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      notice.set(bi('已复制到剪贴板。', 'Copied to clipboard.'));
      return true;
    } catch { /* Fall back to copying the selection when clipboard access is denied. */ }
  }
  try {
    if (copyWithSelection(text)) {
      notice.set(bi('已复制到剪贴板。', 'Copied to clipboard.'));
      return true;
    }
  } catch { /* The interface provides selectable text for manual copying. */ }
  notice.set(bi('无法访问剪贴板，请长按或选中文字复制。', 'Clipboard unavailable. Select the text and copy it manually.'));
  return false;
}
window.addEventListener('online', () => { const s = get(session); if (s) { disconnect(); connect(s); } });
document.addEventListener('visibilitychange', () => { const s = get(session); if (s && document.visibilityState === 'visible') { if (!socket || socket.readyState > 1) { disconnect(); connect(s); } else refresh(s); } });
