import { expect, test } from 'bun:test';
import { sameSnapshot, snapshotCache } from '../src/lib/snapshots';
import { newRoom } from '../server/engine';
import type { RoomView } from '../shared/types';

function state(revision = 1): RoomView {
  const { gmNotes, polls, ...room } = newRoom('1234', 'GM', { mode: 'short', gmCount: 1, dice: 'physical' });
  return { ...room, polls: [], me: room.hostId, online: [room.hostId, 'player'], revision };
}

test('duplicate HTTP and WebSocket snapshots are skipped, but presence and identity changes are accepted', () => {
  const current = state();
  expect(sameSnapshot(null, current)).toBeFalse();
  expect(sameSnapshot(current, structuredClone(current))).toBeTrue();
  expect(sameSnapshot(current, { ...current, online: [...current.online].reverse() })).toBeTrue();
  for (const next of [
    { ...current, revision: 2 }, { ...current, online: [current.me] },
    { ...current, online: [current.me, 'another-player'] },
    { ...current, me: 'another-member' }, { ...current, id: 'another-room' }
  ]) expect(sameSnapshot(current, next)).toBeFalse();
});

test('a burst of snapshots writes only the latest cache after yielding to the UI', async () => {
  const writes: RoomView[] = [];
  const cache = snapshotCache(value => writes.push(value), 10);
  const first = state(), last = { ...first, revision: 20 };
  cache.queue(first); cache.queue({ ...first, revision: 10 }); cache.queue(last);
  expect(writes).toHaveLength(0);
  await Bun.sleep(30);
  expect(writes).toEqual([last]);
});

test('leaving or hiding a page flushes pending cache without a second delayed write', async () => {
  const writes: RoomView[] = [];
  const cache = snapshotCache(value => writes.push(value), 10);
  const latest = state(); cache.queue(latest); cache.flush();
  expect(writes).toEqual([latest]);
  await Bun.sleep(30); expect(writes).toEqual([latest]);
  cache.flush(); expect(writes).toEqual([latest]);
  const next = { ...latest, revision: 2 }; cache.queue(next); cache.flush();
  expect(writes).toEqual([latest, next]);
});

test('unavailable browser storage does not interrupt later cache updates', () => {
  let attempts = 0;
  const cache = snapshotCache(() => { attempts++; throw new Error('Storage unavailable'); });
  cache.queue(state()); expect(() => cache.flush()).not.toThrow();
  cache.queue(state(2)); expect(() => cache.flush()).not.toThrow();
  expect(attempts).toBe(2);
});
