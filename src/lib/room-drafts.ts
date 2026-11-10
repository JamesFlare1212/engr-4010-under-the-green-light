import { writable, type Readable } from 'svelte/store';
import { bi, type RoomView, type Text } from '../../shared/types';

export function copyDraft<T>(value: T): T {
  if (Array.isArray(value)) return value.map(copyDraft) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copyDraft(item)])) as T;
  return value;
}
export interface EditorState<T> { value: T; revision: number; editing: boolean; version: number; dirty: boolean; pending: boolean }
export function createEditor<T>(initial: () => T, revision = 0) {
  let state: EditorState<T> = { value: copyDraft(initial()), revision, editing: false, version: 0, dirty: false, pending: false };
  const store = writable(state);
  let operation = 0, disposed = false;
  const update = (patch: Partial<EditorState<T>>) => { state = { ...state, ...patch }; store.set(state); };
  function edit(value: T) {
    if (disposed || JSON.stringify(value) === JSON.stringify(state.value)) return;
    update({ value: copyDraft(value), version: state.version + 1, dirty: true });
  }
  function patch<K extends keyof T>(key: K, value: T[K]) { edit({ ...state.value, [key]: value }); }
  function begin(value: T, nextRevision: number) {
    if (!disposed) update({ value: copyDraft(value), revision: nextRevision, editing: true, version: state.version + 1, dirty: false });
  }
  function review(nextRevision: number) { if (!disposed) update({ revision: nextRevision, version: state.version + 1 }); }
  function cancel() { if (!disposed) update({ value: copyDraft(initial()), editing: false, version: state.version + 1, dirty: false }); }
  function clear() {
    operation++;
    update({ value: copyDraft(initial()), revision: 0, editing: false, version: state.version + 1, dirty: false, pending: false });
  }
  async function save(send: (value: T, revision: number) => Promise<boolean>, mode: 'close' | 'keep' | 'clear' = 'close', empty: () => T = initial): Promise<boolean> {
    if (disposed || state.pending) return false;
    const version = state.version, submitted = copyDraft(state.value), expectedRevision = state.revision, ticket = ++operation;
    update({ pending: true });
    try {
      const success = await send(submitted, expectedRevision);
      if (disposed || ticket !== operation) return false;
      if (success && version === state.version) {
        update({ dirty: false, ...(mode === 'close' ? { editing: false } : mode === 'clear' ? { value: copyDraft(empty()) } : {}) });
      }
      return success;
    } catch { return false; }
    finally { if (!disposed && ticket === operation) update({ pending: false }); }
  }
  return { subscribe: store.subscribe, edit, patch, begin, review, cancel, clear, save, dispose() { clear(); disposed = true; } };
}
export type Editor<T> = ReturnType<typeof createEditor<T>>;
export interface DraftRecord { key: string; label: Text; value: unknown; revision: number }

/** One vault per mounted room/identity, outside every tab and phase-keyed component. No browser storage or server writes. */
export function createRoomDrafts(readRoom: () => RoomView) {
  const editors = new Map<string, Editor<unknown>>(), models = new Map<string, unknown>(), records = new Map<string, DraftRecord>();
  const store = writable<DraftRecord[]>([]);
  let disposed = false;
  function record(key: string, label: Text, value: unknown, revision: number, dirty: boolean) {
    if (disposed) return;
    if (dirty) records.set(key, { key, label, value: copyDraft(value), revision }); else records.delete(key);
    store.set([...records.values()]);
  }
  function editor<T>(key: string, initial: () => T, revision = readRoom().revision, label = bi('未提交草稿', 'Unsubmitted draft')): Editor<T> {
    const existing = editors.get(key);
    if (existing) return existing as Editor<T>;
    const next = createEditor(initial, revision);
    editors.set(key, next as Editor<unknown>);
    next.subscribe(state => record(key, label, state.value, state.revision, state.dirty));
    return next;
  }
  function remember<T>(key: string, create: () => T): T {
    if (!models.has(key)) models.set(key, create());
    return models.get(key) as T;
  }
  function clearGm() { for (const [key, editor] of editors) if (key.startsWith('gm:')) editor.clear(); }
  function dispose() {
    disposed = true;
    for (const editor of editors.values()) editor.dispose();
    editors.clear(); models.clear(); records.clear(); store.set([]);
  }
  return { subscribe: store.subscribe, editor, remember, record, clearGm, dispose, current: readRoom };
}
export type RoomDrafts = ReturnType<typeof createRoomDrafts>;
let navigationGuard: (() => boolean) | null = null;
export function guardDraftNavigation(guard: () => boolean) {
  navigationGuard = guard;
  return () => { if (navigationGuard === guard) navigationGuard = null; };
}
export function confirmDraftNavigation(): boolean { return navigationGuard?.() ?? true; }
export function draftText(record: DraftRecord, locale: 'zh-CN' | 'en'): string {
  return `${record.label[locale]}\nRevision: ${record.revision}\n\n${typeof record.value === 'string' ? record.value : JSON.stringify(record.value, null, 2)}`;
}
