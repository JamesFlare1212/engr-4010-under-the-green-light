import { describe, expect, test } from 'bun:test';
import { get } from 'svelte/store';
import { createHomeDrafts } from '../src/lib/home-drafts';
import { createDebriefDrafts } from '../src/lib/debrief-drafts';
import { maxArchiveBytes } from '../shared/archive';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const file = (name: string, text: Promise<string>, size = 100) => ({ name, size, text: () => text });

describe('Home uses explicit archive selection state and cancellation generations', () => {
  test('no selection follows the normal join/create wizard, while loading blocks submission', async () => {
    const home = createHomeDrafts();
    expect(get(home).archive.status).toBe('unselected');
    expect(home.prepareSubmission()).toEqual({ kind: 'join' });
    home.selectTab('create');
    expect(home.prepareSubmission()).toBeNull();
    expect(get(home).step).toBe(2);
    expect(home.prepareSubmission()).toBeNull();
    expect(get(home).step).toBe(3);
    expect(home.prepareSubmission()).toEqual({ kind: 'create' });

    const read = deferred<string>();
    const loading = home.loadArchive(file('save.json', read.promise));
    expect(get(home)).toEqual({ tab: 'create', step: 3, archive: { status: 'loading', name: 'save.json' } });
    expect(home.prepareSubmission()).toBeNull();
    read.resolve('{"archive":"chosen"}');
    await loading;
    expect(get(home).archive.status).toBe('selected');
    expect(home.prepareSubmission()).toEqual({ kind: 'import', save: { archive: 'chosen' } });
  });

  test('a slower old File.text cannot replace the latest selection, even with the same filename', async () => {
    const home = createHomeDrafts(), old = deferred<string>(), latest = deferred<string>();
    const first = home.loadArchive(file('save.json', old.promise));
    const second = home.loadArchive(file('save.json', latest.promise));
    latest.resolve('{"chosen":2}');
    await second;
    const selected = get(home);
    old.resolve('{"chosen":1}');
    await first;
    expect(get(home)).toBe(selected);
    expect(home.prepareSubmission()).toEqual({ kind: 'import', save: { chosen: 2 } });
  });

  test('an old rejection cannot change a newer successful selection into a failure', async () => {
    const home = createHomeDrafts(), old = deferred<string>();
    const first = home.loadArchive(file('old.json', old.promise));
    await home.loadArchive(file('new.json', Promise.resolve('{"new":true}')));
    const selected = get(home);
    old.reject(new Error('old read failed'));
    await first;
    expect(get(home)).toBe(selected);
  });

  test.each(['join', 'create'] as const)('switching to the %s tab cancels the pending read', async tab => {
    const home = createHomeDrafts(), read = deferred<string>();
    const loading = home.loadArchive(file('save.json', read.promise));
    home.selectTab(tab);
    const cancelled = get(home);
    expect(cancelled.archive.status).toBe('unselected');
    expect(home.prepareSubmission()).toEqual({ kind: tab });
    read.resolve('{"late":true}');
    await loading;
    expect(get(home)).toBe(cancelled);
    expect(get(home).tab).toBe(tab);
  });

  test('back navigation cancels the read and cannot be undone by its late result', async () => {
    const home = createHomeDrafts(), read = deferred<string>();
    const loading = home.loadArchive(file('save.json', read.promise));
    home.previous();
    const cancelled = get(home);
    expect(cancelled).toEqual({ tab: 'create', step: 2, archive: { status: 'unselected' } });
    read.resolve('{"late":true}');
    await loading;
    expect(get(home)).toBe(cancelled);
    expect(home.prepareSubmission()).toBeNull();
    expect(home.prepareSubmission()).toEqual({ kind: 'create' });
  });

  test('explicit cancellation or an empty selection invalidates both late success and failure', async () => {
    const home = createHomeDrafts(), old = deferred<string>(), next = deferred<string>();
    const first = home.loadArchive(file('old.json', old.promise));
    home.cancelArchive();
    old.resolve('{"late":true}');
    await first;
    expect(get(home).archive.status).toBe('unselected');
    const second = home.loadArchive(file('next.json', next.promise));
    await home.loadArchive();
    next.reject(new Error('cancelled read'));
    await second;
    expect(get(home).archive.status).toBe('unselected');
  });

  test.each(['null', 'false', 'true', '0', '1', '""', '"archive"', '[]'])('invalid JSON root %s never falls back to create', async json => {
    const home = createHomeDrafts();
    await home.loadArchive(file('invalid.json', Promise.resolve(json)));
    expect(get(home).archive).toEqual({ status: 'failed', name: 'invalid.json', reason: 'invalid-root' });
    expect(home.prepareSubmission()).toBeNull();
  });

  test('a failed replacement clears the old selection, blocks create/import, and can be retried', async () => {
    const home = createHomeDrafts(), read = deferred<string>();
    await home.loadArchive(file('good.json', Promise.resolve('{"first":true}')));
    const loading = home.loadArchive(file('broken.json', read.promise));
    expect(get(home).archive.status).toBe('loading');
    expect(home.prepareSubmission()).toBeNull();
    read.reject(new Error('File.text failed'));
    await loading;
    expect(get(home).archive).toEqual({ status: 'failed', name: 'broken.json', reason: 'unreadable' });
    expect(home.prepareSubmission()).toBeNull();
    await home.loadArchive(file('broken.json', Promise.resolve('{"fixed":true}')));
    expect(home.prepareSubmission()).toEqual({ kind: 'import', save: { fixed: true } });
  });

  test('malformed JSON is a blocking failure, not a new room', async () => {
    const home = createHomeDrafts();
    await home.loadArchive(file('syntax.json', Promise.resolve('{')));
    expect(get(home).archive).toEqual({ status: 'failed', name: 'syntax.json', reason: 'unreadable' });
    expect(home.prepareSubmission()).toBeNull();
    home.previous();
    expect(home.prepareSubmission()).toBeNull();
    expect(home.prepareSubmission()).toEqual({ kind: 'create' });
  });

  test('a file at the shared UTF-8 byte limit is allowed (including files over the old 1 MiB limit)', async () => {
    const home = createHomeDrafts();
    await home.loadArchive(file('boundary.json', Promise.resolve('{"boundary":true}'), maxArchiveBytes));
    expect(home.prepareSubmission()).toEqual({ kind: 'import', save: { boundary: true } });
  });

  test('an oversized new choice invalidates an old read without reading the oversized file', async () => {
    const home = createHomeDrafts(), read = deferred<string>();
    const loading = home.loadArchive(file('old.json', read.promise));
    let reads = 0;
    await home.loadArchive({ name: 'large.json', size: maxArchiveBytes + 1, text: async () => { reads++; return '{}'; } });
    const failed = get(home);
    expect(failed.archive).toEqual({ status: 'failed', name: 'large.json', reason: 'too-large' });
    expect(reads).toBe(0);
    expect(home.prepareSubmission()).toBeNull();
    read.resolve('{"old":true}');
    await loading;
    expect(get(home)).toBe(failed);
  });
});

describe('Debrief keeps per-question drafts and confirms only the submitted version', () => {
  test('initial server answers load once per question; current-question clicks and switches preserve edits', () => {
    const saved: Record<string, string> = { '0': 'saved A', '1': 'saved B' }, reads: string[] = [];
    const drafts = createDebriefDrafts(prompt => { reads.push(prompt); return saved[prompt] ?? ''; });
    expect(get(drafts).drafts['0'].text).toBe('saved A');
    drafts.edit('draft A');
    drafts.select('0');
    expect(get(drafts).drafts['0'].text).toBe('draft A');
    drafts.select('1');
    expect(get(drafts).drafts['1'].text).toBe('saved B');
    drafts.edit('draft B');
    saved['0'] = 'new snapshot A';
    saved['1'] = 'new snapshot B';
    drafts.select('0');
    expect(get(drafts).drafts['0'].text).toBe('draft A');
    drafts.select('1');
    expect(get(drafts).drafts['1'].text).toBe('draft B');
    expect(reads).toEqual(['0', '1']);
  });

  test('A success while B is selected only confirms A and never changes B or the selection', async () => {
    const drafts = createDebriefDrafts(() => ''), response = deferred<boolean>();
    const sent: { prompt: string; text: string }[] = [];
    drafts.edit('submitted A');
    const sharing = drafts.submit((prompt, text) => { sent.push({ prompt, text }); return response.promise; });
    expect(get(drafts).drafts['0'].pending).toBe(true);
    drafts.select('1');
    drafts.edit('unsaved B');
    const b = get(drafts).drafts['1'];
    response.resolve(true);
    expect(await sharing).toBe(true);
    expect(sent).toEqual([{ prompt: '0', text: 'submitted A' }]);
    expect(get(drafts).prompt).toBe('1');
    expect(get(drafts).drafts['1']).toBe(b);
    expect(get(drafts).drafts['0']).toEqual({ text: 'submitted A', version: 1, confirmedVersion: 1, pending: false });
    drafts.select('0');
    expect(get(drafts).drafts['0'].text).toBe('submitted A');
  });

  test('editing A while its submission is pending keeps the newer version dirty after success', async () => {
    const drafts = createDebriefDrafts(() => ''), response = deferred<boolean>();
    drafts.edit('A version 1');
    const sharing = drafts.submit((_prompt, text) => { expect(text).toBe('A version 1'); return response.promise; });
    drafts.edit('A version 2');
    response.resolve(true);
    await sharing;
    expect(get(drafts).drafts['0']).toEqual({ text: 'A version 2', version: 2, confirmedVersion: 1, pending: false });
    await drafts.submit(async (_prompt, text) => { expect(text).toBe('A version 2'); return true; });
    expect(get(drafts).drafts['0']).toEqual({ text: 'A version 2', version: 2, confirmedVersion: 2, pending: false });
  });

  test('version identity, not text equality, governs confirmation after edit-away-and-back', async () => {
    const drafts = createDebriefDrafts(() => ''), response = deferred<boolean>();
    drafts.edit('same text');
    const sharing = drafts.submit(() => response.promise);
    drafts.edit('different text');
    drafts.edit('same text');
    response.resolve(true);
    await sharing;
    expect(get(drafts).drafts['0']).toEqual({ text: 'same text', version: 3, confirmedVersion: 1, pending: false });
  });

  test.each(['false', 'reject'])('a %s response preserves unsaved and newer drafts without confirmation', async outcome => {
    const drafts = createDebriefDrafts(() => ''), response = deferred<boolean>();
    drafts.edit('submitted A');
    const sharing = drafts.submit(() => response.promise);
    drafts.edit('newer A');
    drafts.select('1');
    drafts.edit('unsaved B');
    const b = get(drafts).drafts['1'];
    if (outcome === 'reject') response.reject(new Error('network failure'));
    else response.resolve(false);
    expect(await sharing).toBe(false);
    expect(get(drafts).prompt).toBe('1');
    expect(get(drafts).drafts['1']).toBe(b);
    expect(get(drafts).drafts['0']).toEqual({ text: 'newer A', version: 2, confirmedVersion: 0, pending: false });
    drafts.select('0');
    expect(await drafts.submit(async (_prompt, text) => { expect(text).toBe('newer A'); return true; })).toBe(true);
    expect(get(drafts).drafts['0'].confirmedVersion).toBe(2);
  });

  test('duplicate pending submissions do not send again or confirm a newer version', async () => {
    const drafts = createDebriefDrafts(() => ''), response = deferred<boolean>();
    drafts.edit('first');
    let sends = 0;
    const share = () => { sends++; return response.promise; };
    const sharing = drafts.submit(share);
    drafts.edit('second');
    expect(await drafts.submit(share)).toBe(false);
    expect(sends).toBe(1);
    response.resolve(true);
    await sharing;
    expect(get(drafts).drafts['0']).toEqual({ text: 'second', version: 2, confirmedVersion: 1, pending: false });
  });

  test('different questions can finish out of order without confirming or clearing each other', async () => {
    const drafts = createDebriefDrafts(() => ''), a = deferred<boolean>(), b = deferred<boolean>();
    drafts.edit('A');
    const first = drafts.submit(() => a.promise);
    drafts.select('1');
    drafts.edit('B');
    const second = drafts.submit(() => b.promise);
    b.resolve(true);
    await second;
    const confirmedB = get(drafts).drafts['1'];
    a.resolve(true);
    await first;
    expect(get(drafts).drafts['1']).toBe(confirmedB);
    expect(get(drafts).drafts['0'].confirmedVersion).toBe(1);
    expect(get(drafts).drafts['1'].confirmedVersion).toBe(1);
    expect(get(drafts).prompt).toBe('1');
  });
});
