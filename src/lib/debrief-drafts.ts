import { writable } from 'svelte/store';

type ReflectionDraft = { text: string; version: number; confirmedVersion: number; pending: boolean };
type DebriefDraft = { prompt: string; drafts: Record<string, ReflectionDraft> };
type Share = (prompt: string, text: string) => Promise<boolean>;

/** Drafts belong to one Debrief instance, not to the latest server snapshot or selected prompt. */
export function createDebriefDrafts(readSaved: (prompt: string) => string) {
  const initial = (prompt: string): ReflectionDraft => ({ text: readSaved(prompt), version: 0, confirmedVersion: 0, pending: false });
  let current: DebriefDraft = { prompt: '0', drafts: { '0': initial('0') } };
  const state = writable(current);
  function set(next: DebriefDraft) { current = next; state.set(next); }
  function update(prompt: string, draft: ReflectionDraft) {
    set({ ...current, drafts: { ...current.drafts, [prompt]: draft } });
  }
  function select(prompt: string) {
    set({ prompt, drafts: { ...current.drafts, [prompt]: current.drafts[prompt] ?? initial(prompt) } });
  }
  function edit(text: string) {
    const draft = current.drafts[current.prompt];
    if (text !== draft.text) update(current.prompt, { ...draft, text, version: draft.version + 1 });
  }
  async function submit(share: Share): Promise<boolean> {
    const prompt = current.prompt, submitted = current.drafts[prompt];
    if (submitted.pending || !submitted.text) return false;
    update(prompt, { ...submitted, pending: true });
    try {
      if (!await share(prompt, submitted.text)) return false;
      const latest = current.drafts[prompt];
      // Confirm only the submitted version. Keep its text for editing, and never clear newer/other drafts.
      update(prompt, { ...latest, confirmedVersion: submitted.version });
      return true;
    } catch { return false; }
    finally { update(prompt, { ...current.drafts[prompt], pending: false }); }
  }
  return { subscribe: state.subscribe, select, edit, submit };
}
