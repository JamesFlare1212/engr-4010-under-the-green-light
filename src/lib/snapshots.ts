import type { RoomView } from '../../shared/types';

export function sameSnapshot(current: RoomView | null, next: RoomView): boolean {
  // Presence can change without advancing the saved room revision.
  return current !== null && current.id === next.id && current.me === next.me && current.revision === next.revision
    && current.online.length === next.online.length && current.online.every(id => next.online.includes(id));
}

export function snapshotCache(write: (state: RoomView) => void, delay = 250) {
  let pending: RoomView | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function flush() {
    clearTimeout(timer); timer = undefined;
    const state = pending; pending = null;
    if (state) {
      try { write(state); } catch { /* Network state remains authoritative if browser storage is unavailable. */ }
    }
  }
  return {
    queue(state: RoomView) {
      pending = state;
      // Keep only the latest state and allow the UI to update before synchronous storage work.
      if (timer === undefined) timer = setTimeout(flush, delay);
    },
    flush
  };
}
