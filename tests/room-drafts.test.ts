import { expect, test } from 'bun:test';
import { get } from 'svelte/store';
import { createEditor, createRoomDrafts, draftText, guardDraftNavigation, confirmDraftNavigation } from '../src/lib/room-drafts';
import { bi, type RoomView } from '../shared/types';
import { newRoom } from '../server/engine';

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function room(): RoomView { const value = newRoom('1234', 'GM', { mode: 'short', gmCount: 1, dice: 'physical' }); return { ...value, polls: [], me: value.hostId, online: [] }; }

test('one room vault retains the same editor through tab and phase component remounts, including the original revision', () => {
  let game = room(); const vault = createRoomDrafts(() => game);
  const report = vault.editor('report', () => ({ statement: '' }), game.revision, bi('交接', 'Handover'));
  report.begin({ statement: 'Original' }, 2); report.patch('statement', 'Unsaved');
  game = { ...game, phase: 'debrief', revision: 9 };
  const remounted = vault.editor('report', () => ({ statement: 'Remote replacement' }), game.revision);
  expect(remounted).toBe(report); expect(get(remounted)).toMatchObject({ value: { statement: 'Unsaved' }, revision: 2, editing: true, dirty: true });
  expect(get(vault)).toHaveLength(1); expect(draftText(get(vault)[0]!, 'en')).toContain('Unsaved');
  const anotherIdentity = createRoomDrafts(() => ({ ...game, me: 'other' }));
  expect(get(anotherIdentity.editor('report', () => ({ statement: '' }))).value.statement).toBe('');
});

test('successful old saves cannot close or clear later edits, including text ABA and cancel/reopen', async () => {
  for (const action of ['edit', 'aba', 'reopen'] as const) {
    const editor = createEditor(() => ({ text: '' }), 3), response = deferred<boolean>();
    editor.begin({ text: 'Submitted' }, 3);
    const saving = editor.save(async (value, revision) => { expect(value).toEqual({ text: 'Submitted' }); expect(revision).toBe(3); return response.promise; });
    if (action === 'edit') editor.patch('text', 'New draft');
    if (action === 'aba') { editor.patch('text', 'Other'); editor.patch('text', 'Submitted'); }
    if (action === 'reopen') { editor.cancel(); editor.begin({ text: 'Submitted' }, 3); }
    response.resolve(true); expect(await saving).toBe(true);
    expect(get(editor).editing).toBe(true); expect(get(editor).value.text).toBe(action === 'edit' ? 'New draft' : 'Submitted');
    expect(get(editor).pending).toBe(false);
  }
});

test('failed saves preserve draft and revision, while unchanged successful saves can close or clear only their own editor', async () => {
  const editor = createEditor(() => '', 4); editor.begin('Draft', 4); editor.edit('Typed');
  expect(await editor.save(async () => false)).toBe(false); expect(get(editor)).toMatchObject({ value: 'Typed', editing: true, dirty: true, revision: 4 });
  expect(await editor.save(async () => { throw new Error('Network'); })).toBe(false);
  editor.review(7); expect(await editor.save(async (_value, revision) => { expect(revision).toBe(7); return true; }, 'clear')).toBe(true);
  expect(get(editor)).toMatchObject({ value: '', dirty: false, pending: false });
});

test('GM draft purge invalidates pending callbacks and cannot resurrect private text after permission returns', async () => {
  const vault = createRoomDrafts(room), editor = vault.editor('gm:notes', () => '', 2), response = deferred<boolean>();
  editor.begin('PRIVATE', 2); editor.edit('PRIVATE draft'); const saving = editor.save(() => response.promise);
  vault.clearGm(); expect(get(editor).value).toBe(''); expect(get(vault)).toEqual([]);
  editor.begin('New session', 5); editor.edit('New private draft');
  response.resolve(true); expect(await saving).toBe(false);
  expect(get(editor)).toMatchObject({ value: 'New private draft', editing: true, pending: false });
});

test('navigation guards require explicit discard and an old cleanup cannot remove the replacement room guard', () => {
  const first = guardDraftNavigation(() => false); expect(confirmDraftNavigation()).toBe(false);
  const second = guardDraftNavigation(() => false); first(); expect(confirmDraftNavigation()).toBe(false);
  second(); expect(confirmDraftNavigation()).toBe(true);
});

test('disposing a room invalidates pending success and does not share drafts with its replacement', async () => {
  const vault = createRoomDrafts(room), editor = vault.editor('report', () => '', 1), response = deferred<boolean>();
  editor.begin('Old', 1); editor.edit('Unsaved'); const saving = editor.save(() => response.promise);
  vault.dispose(); response.resolve(true); expect(await saving).toBe(false); expect(get(vault)).toEqual([]);
  expect(get(createRoomDrafts(room).editor('report', () => 'New'))).toMatchObject({ value: 'New', pending: false });
});
