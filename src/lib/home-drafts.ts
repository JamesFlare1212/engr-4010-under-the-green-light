import { writable } from 'svelte/store';
import { maxArchiveBytes } from '../../shared/archive';

export type ArchiveFailure = 'too-large' | 'unreadable' | 'invalid-root';
export type ArchiveSelection =
  | { status: 'unselected' }
  | { status: 'loading'; name: string }
  | { status: 'failed'; name: string; reason: ArchiveFailure }
  | { status: 'selected'; name: string; save: Record<string, unknown> };
type HomeDraft = { tab: 'join' | 'create'; step: number; archive: ArchiveSelection };
type ArchiveFile = Pick<File, 'name' | 'size' | 'text'>;
type Submission = { kind: 'join' | 'create' } | { kind: 'import'; save: Record<string, unknown> };

/** Home-only setup state. File.text cannot be aborted, so every selection/navigation invalidates its result. */
export function createHomeDrafts() {
  let current: HomeDraft = { tab: 'join', step: 1, archive: { status: 'unselected' } };
  const state = writable(current);
  let generation = 0;
  function set(next: HomeDraft) { current = next; state.set(next); }
  function cancelArchive() {
    generation++;
    set({ ...current, archive: { status: 'unselected' } });
  }
  function selectTab(tab: HomeDraft['tab']) {
    generation++;
    set({ ...current, tab, archive: { status: 'unselected' } });
  }
  function previous() {
    generation++;
    set({ ...current, step: Math.max(1, current.step - 1), archive: { status: 'unselected' } });
  }
  async function loadArchive(file?: ArchiveFile) {
    if (!file) { cancelArchive(); return; }
    const selection = ++generation;
    // Navigate before reading, never from a delayed completion callback.
    set({ tab: 'create', step: 3, archive: { status: 'loading', name: file.name } });
    const fail = (reason: ArchiveFailure) => {
      if (selection === generation) set({ ...current, archive: { status: 'failed', name: file.name, reason } });
    };
    if (file.size > maxArchiveBytes) { fail('too-large'); return; }
    try {
      const save: unknown = JSON.parse(await file.text());
      if (selection !== generation) return;
      // The server validates the archive schema; primitive/array roots are never a create-room fallback.
      if (save === null || typeof save !== 'object' || Array.isArray(save)) { fail('invalid-root'); return; }
      set({ ...current, archive: { status: 'selected', name: file.name, save: save as Record<string, unknown> } });
    } catch { fail('unreadable'); }
  }
  function prepareSubmission(): Submission | null {
    const { tab, step, archive } = current;
    if (archive.status === 'loading' || archive.status === 'failed') return null;
    if (tab === 'join') return { kind: 'join' };
    if (archive.status === 'selected') return { kind: 'import', save: archive.save };
    if (step < 3) { set({ ...current, step: step + 1 }); return null; }
    return { kind: 'create' };
  }
  return { subscribe: state.subscribe, selectTab, previous, cancelArchive, loadArchive, prepareSubmission };
}
