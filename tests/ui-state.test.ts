import { beforeAll, expect, test } from 'bun:test';
import { get } from 'svelte/store';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { compileModule, parse } from 'svelte/compiler';
import { newRoom } from '../server/engine';
import { bi, phases, type RoomView } from '../shared/types';
import { createRoomDrafts, draftText, guardDraftNavigation, type RoomDrafts } from '../src/lib/room-drafts';
import { createDebriefDrafts } from '../src/lib/debrief-drafts';
import { scenes, tracks } from '../shared/content';
import { handoverComplete, isPendingPoll } from '../shared/state';

const bundles = new Map<string, string>();
const bridges: Record<string, string> = {
  Stage: `return { read, saveSettings, reloadSettings, saveCustomRoute, editCustom(value) { customEditor.edit(value); }, get custom() { return $customEditor.value; }, setGame(value) { game = value; }, get speaking() { return speaking; }, get settingsRevision() { return settingsRevision; } };`,
  Room: `return { share, copyInvite, saveNotes, cancelNotes, drafts: roomDrafts, setPresenting(value) { presenting = value; }, get visibleDrafts() { return localDrafts; }, setGame(value) { game = value; }, setUrl(value) { joinUrl = value; }, setNotes(value) { notesEditor.edit(value); }, bind(share, notes, input) { shareDialog = share; notesDialog = notes; joinInput = input; }, openNotes, get qr() { return qr; }, get notesDraft() { return notesDraft; }, get copyStatus() { return copyStatus; } };`,
  Handover: `return { beginEdit, saveReport, cancel: editor.cancel, edit(value) { editor.edit(value); }, get draft() { return $editor; }, setGame(value) { game = value; } };`,
  People: `return { toggleProfile, saveProfile, edit(value) { editor.edit(value); }, get draft() { return $editor; }, setGame(value) { game = value; } };`,
  Debrief: `return { drafts, get current() { return $drafts; }, setGame(value) { game = value; } };`
};
beforeAll(async () => {
  for (const [name, bridge] of Object.entries(bridges)) {
    const source = readFileSync(`${import.meta.dir}/../src/components/${name}.svelte`, 'utf8');
    const ast = parse(source), instance = ast.instance!;
    const imports = (instance.content.body as unknown as { type: string; start: number; end: number; specifiers: { local: { name: string } }[] }[]).filter(node => node.type === 'ImportDeclaration');
    let script = source.slice(instance.content.start, instance.content.end);
    for (const node of [...imports].reverse()) script = script.slice(0, node.start! - instance.content.start) + script.slice(node.end! - instance.content.start);
    const bindings = imports.flatMap(node => node.type === 'ImportDeclaration' ? node.specifiers.map(specifier => specifier.local.name) : []).filter(name => name !== 'untrack');
    script = script.replace(/let \{ game[^\n]*= \$props\(\);/, `let game = $state.raw(env.initial); ${name !== 'Room' ? 'let gm = $state(true); const onshare = () => {}; const roomDrafts = env.roomDrafts ?? createRoomDrafts(() => game);' : ''}`)
      .replaceAll('$locale', 'env.locale').replaceAll('$busy', 'env.busy').replaceAll('$connection', 'env.connection');
    // Execute the actual component script with real Svelte effects, but no DOM rendering.
    const body = `${script}\n${bridge}`.replace(/\$(editor|tracksEditor|settingsEditor|customEditor|roomDrafts|notesEditor|drafts)\b/g, 'readStore($1)');
    const plain = new Bun.Transpiler({ loader: 'ts', deadCodeElimination: false, treeShaking: false }).transformSync(`import { untrack } from 'svelte'; import { fromStore } from 'svelte/store'; export function setup(env) { const subscriptions = new Map(); function readStore(store) { if (!subscriptions.has(store)) subscriptions.set(store, fromStore(store)); return subscriptions.get(store).current; } const { ${bindings.join(', ')} } = env; ${body} }`);
    const compiled = compileModule(plain, { filename: `${name}.svelte.js`, generate: 'client' }).js.code;
    const result = await Bun.build({ entrypoints: ['test-ui-entry'], target: 'browser', format: 'iife', plugins: [{ name: 'component-scripts', setup(build) {
      build.onResolve({ filter: /^test-ui-/ }, args => ({ path: args.path, namespace: 'component-script' }));
      build.onLoad({ filter: /.*/, namespace: 'component-script' }, args => ({ loader: 'js', resolveDir: `${import.meta.dir}/..`, contents: args.path === 'test-ui-script' ? compiled : `import { setup } from 'test-ui-script'; import { flushSync } from 'svelte'; import { effect_root } from 'svelte/internal/client'; let value; const stop = effect_root(() => { value = setup(globalThis.env); }); globalThis.testUi = { value, flush: flushSync, stop };` }));
    } }] });
    if (!result.success) throw new AggregateError(result.logs, `${name} script bundle failed`);
    bundles.set(name, await result.outputs[0]!.text());
  }
}, 15_000);
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function game(): RoomView { const room = newRoom('1234', 'GM', { mode: 'short', gmCount: 2, dice: 'physical' }); return { ...room, polls: [], me: room.hostId, online: [] }; }
function dialog() { return { open: false, showModal() { this.open = true; }, close() { this.open = false; } }; }
// Bridges are test-only accessors appended to extracted scripts; production components are unchanged by the harness.
function component(name: string, initial: RoomView, extra: Record<string, unknown> = {}) {
  const cleanup: (() => void)[] = [];
  const speech = { cancelled: 0, cancel() { this.cancelled++; }, speak(_utterance: unknown) {} };
  const env = { initial, locale: 'en', busy: false, connection: 'live', bi, createRoomDrafts, createDebriefDrafts, draftText, guardDraftNavigation, tracks, scenes, phases, handoverComplete, isPendingPoll,
    onMount() {}, onDestroy: (callback: () => void) => cleanup.push(callback), QRCode: { toDataURL: async () => 'qr-code' }, command: async () => true, ...extra };
  const context = { env, window: { speechSynthesis: speech, scrollTo() {} }, speechSynthesis: speech,
    SpeechSynthesisUtterance: class { constructor(public text: string) {} }, location: { origin: 'https://game.test' }, console, setTimeout, clearTimeout, queueMicrotask,
    testUi: undefined as { value: any; flush: () => void; stop: () => void } | undefined };
  runInNewContext(bundles.get(name)!, context);
  const runtime = context.testUi!; runtime.flush();
  return { ui: runtime.value, flush: runtime.flush, speech, stop() { runtime.stop(); cleanup.forEach(fn => fn()); } };
}

test('handover editing survives tab remount and a remote ending-to-debrief transition without upgrading its revision', () => {
  let current = game(); current.phase = 'ending'; const roomDrafts = createRoomDrafts(() => current);
  const first = component('Handover', current, { roomDrafts }); first.ui.beginEdit(); first.ui.edit({ ...current.report, statement: 'Unsaved handover' }); first.stop();
  current = { ...current, phase: 'debrief', revision: 7, report: { ...current.report, statement: 'Another member saved this' } };
  const second = component('Handover', current, { roomDrafts });
  expect(second.ui.draft).toMatchObject({ editing: true, dirty: true, revision: 0, value: { statement: 'Unsaved handover' } });
  expect(draftText(get(roomDrafts)[0]!, 'en')).toContain('Unsaved handover');
  second.stop(); roomDrafts.dispose();
});

test('handover success does not close a newer edit or a cancel-and-reopened editor', async () => {
  for (const reopen of [false, true]) {
    const initial = game(), saved = deferred<boolean>(); initial.phase = 'ending';
    const c = component('Handover', initial, { command: () => saved.promise });
    c.ui.beginEdit(); c.ui.edit({ ...initial.report, statement: 'Submitted' }); const pending = c.ui.saveReport({ preventDefault() {} });
    if (reopen) { c.ui.cancel(); c.ui.beginEdit(); }
    c.ui.edit({ ...initial.report, statement: 'New draft' }); saved.resolve(true); await pending;
    expect(c.ui.draft).toMatchObject({ editing: true, value: { statement: 'New draft' } }); c.stop();
  }
});

test('profile drafts survive switching between lobby and team tabs and old success cannot close a reopened profile', async () => {
  const initial = game(), roomDrafts = createRoomDrafts(() => initial), saved = deferred<boolean>();
  const first = component('People', initial, { roomDrafts, command: () => saved.promise }); first.ui.toggleProfile();
  first.ui.edit({ name: 'Submitted', character: 'medic' }); const pending = first.ui.saveProfile({ preventDefault() {} }); first.stop();
  const second = component('People', initial, { roomDrafts }); expect(second.ui.draft.value.name).toBe('Submitted');
  second.ui.toggleProfile(); second.ui.toggleProfile(); second.ui.edit({ name: 'New profile', character: 'scout' });
  saved.resolve(true); await pending;
  expect(second.ui.draft).toMatchObject({ editing: true, value: { name: 'New profile', character: 'scout' } }); second.stop(); roomDrafts.dispose();
});

test('a custom route remains recoverable after its stage is destroyed and never submits with an automatic latest revision', async () => {
  let current = game(); current.phase = 'route_choice'; const roomDrafts = createRoomDrafts(() => current), calls: unknown[][] = [];
  const first = component('Stage', current, { roomDrafts }); first.ui.editCustom({ plan: 'Unsaved hybrid', costs: 'Battery', assumptions: 'Check winch' }); first.stop();
  current = { ...current, revision: 12 };
  const second = component('Stage', current, { roomDrafts, command: (...args: unknown[]) => { calls.push(args); return Promise.resolve(false); } });
  expect(second.ui.custom.plan).toBe('Unsaved hybrid'); await second.ui.saveCustomRoute({ preventDefault() {} }); expect(calls[0]![2]).toBe(0);
  second.stop(); roomDrafts.dispose();
});

test('reflection drafts and selection survive debrief component remounts', () => {
  const initial = game(); initial.phase = 'debrief'; const roomDrafts = createRoomDrafts(() => initial);
  const first = component('Debrief', initial, { roomDrafts }); first.ui.drafts.select('2'); first.ui.drafts.edit('A local reflection'); first.stop();
  const second = component('Debrief', initial, { roomDrafts });
  expect(second.ui.current.prompt).toBe('2'); expect(second.ui.current.drafts['2'].text).toBe('A local reflection'); second.stop(); roomDrafts.dispose();
});

test('read-aloud survives same-phase snapshots, but stops on phase change and destruction', () => {
  const initial = game(); initial.phase = 'briefing'; const c = component('Stage', initial);
  c.ui.read(); const count = c.speech.cancelled; expect(c.ui.speaking).toBe(true);
  c.ui.setGame({ ...initial, revision: 2, online: ['new-tab'] }); c.flush();
  expect(c.speech.cancelled).toBe(count); expect(c.ui.speaking).toBe(true);
  c.ui.setGame({ ...initial, phase: 'investigation' }); c.flush();
  expect(c.speech.cancelled).toBe(count + 1); expect(c.ui.speaking).toBe(false);
  c.stop(); expect(c.speech.cancelled).toBe(count + 2);
});

test('lobby settings submit their captured revision rather than silently overwriting a Co-GM', async () => {
  const initial = game(), calls: unknown[][] = [];
  const c = component('Stage', initial, { command: (...args: unknown[]) => { calls.push(args); return Promise.resolve(true); } });
  c.ui.setGame({ ...initial, revision: 5, settings: { ...initial.settings, mode: 'full' } }); c.flush();
  await c.ui.saveSettings({ preventDefault() {} }); expect(calls[0]![2]).toBe(0);
  c.ui.reloadSettings(); await c.ui.saveSettings({ preventDefault() {} }); expect(calls[1]![2]).toBe(5);
  expect(calls[1]![1]).toMatchObject({ mode: 'full' }); c.stop();
});

test('a demotion closes the notes dialog and erases the private local draft', () => {
  const initial = game(); initial.gmNotes = 'PRIVATE'; const notes = dialog(), c = component('Room', initial);
  c.ui.bind(dialog(), notes, {}); c.ui.openNotes(); expect(notes.open).toBe(true);
  const publicView = { ...initial, gmNotes: undefined, revision: 2, members: initial.members.map(member => ({ ...member, role: 'player' as const })) };
  c.ui.setGame(publicView); c.flush();
  expect(notes.open).toBe(false); expect(c.ui.notesDraft).toBe(''); c.stop();
});

test('presentation hides GM plan drafts without destroying them, but a real role downgrade purges them', () => {
  const initial = game(), c = component('Room', initial);
  c.ui.bind(dialog(), dialog(), {});
  const plan = (c.ui.drafts as RoomDrafts).editor('gm:custom-route', () => '', 0); plan.edit('Unsubmitted GM plan'); c.flush();
  expect(c.ui.visibleDrafts).toHaveLength(1);
  c.ui.setPresenting(true); c.flush(); expect(c.ui.visibleDrafts).toHaveLength(0); expect(get(plan).value).toBe('Unsubmitted GM plan');
  c.ui.setPresenting(false); c.flush(); expect(c.ui.visibleDrafts).toHaveLength(1);
  c.ui.setGame({ ...initial, members: initial.members.map(member => ({ ...member, role: 'player' as const })) }); c.flush();
  expect(get(plan).value).toBe(''); expect(c.ui.visibleDrafts).toHaveLength(0); c.stop();
});

test('a stale clipboard result cannot override a reopened invitation or steal focus', async () => {
  const first = deferred<boolean>(), second = deferred<boolean>(); let count = 0, focused = 0;
  const c = component('Room', game(), { copy: () => (++count === 1 ? first.promise : second.promise) });
  const share = dialog(); c.ui.bind(share, dialog(), { focus() { focused++; }, select() {}, setSelectionRange() {} });
  c.ui.share(); const old = c.ui.copyInvite(); share.close(); c.ui.share(); const fresh = c.ui.copyInvite();
  second.resolve(true); await fresh; expect(c.ui.copyStatus).toBe('copied');
  first.resolve(false); await old; expect(c.ui.copyStatus).toBe('copied'); expect(focused).toBe(0); c.stop();
});

test('destroying a room invalidates its pending invitation copy', async () => {
  const copied = deferred<boolean>(); let focused = 0;
  const c = component('Room', game(), { copy: () => copied.promise });
  c.ui.bind(dialog(), dialog(), { focus() { focused++; }, select() {}, setSelectionRange() {} });
  c.ui.share(); const pending = c.ui.copyInvite(); c.stop();
  copied.resolve(false); await pending; expect(focused).toBe(0);
});

test('changing an invitation URL hides the old QR code while the replacement is pending', async () => {
  const first = deferred<string>(), second = deferred<string>(); let count = 0;
  const c = component('Room', game(), { QRCode: { toDataURL: () => (++count === 1 ? first.promise : second.promise) } });
  first.resolve('old-qr'); await first.promise; c.flush(); expect(c.ui.qr).toBe('old-qr');
  c.ui.setUrl('https://new.test/room/1234'); c.flush(); expect(c.ui.qr).toBe('');
  second.resolve('new-qr'); await second.promise; c.flush(); expect(c.ui.qr).toBe('new-qr'); c.stop();
});

test('saving private notes does not close a newer edit typed while the request was pending', async () => {
  const saved = deferred<boolean>(), notes = dialog(); const c = component('Room', game(), { command: () => saved.promise });
  c.ui.bind(dialog(), notes, {}); c.ui.openNotes(); c.ui.setNotes('Submitted');
  const pending = c.ui.saveNotes({ preventDefault() {} }); c.ui.setNotes('New draft');
  saved.resolve(true); await pending;
  expect(notes.open).toBe(true); expect(c.ui.notesDraft).toBe('New draft'); c.stop();
});
