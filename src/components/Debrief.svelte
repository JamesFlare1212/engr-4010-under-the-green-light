<script lang="ts">
  import { untrack } from 'svelte';
  import Icon from './Icon.svelte';
  import { faComment, faPaperPlane } from '@fortawesome/free-solid-svg-icons';
  import type { RoomView } from '../../shared/types';
  import { bi } from '../../shared/types';
  import { memberName } from '../../shared/members';
  import { createRoomDrafts, type RoomDrafts } from '../lib/room-drafts';
  import { debriefPrompts } from '../../shared/content';
  import { locale } from '../lib/i18n';
  import { command, busy, connection } from '../lib/client';
  import { createDebriefDrafts } from '../lib/debrief-drafts';
  let { game, roomDrafts = createRoomDrafts(() => game) }: { game: RoomView; roomDrafts?: RoomDrafts } = $props();
  const drafts = untrack(() => roomDrafts.remember('reflections', () => {
    const model = createDebriefDrafts(prompt => { const current = roomDrafts.current(); return current.reflections[current.me]?.[prompt] ?? ''; });
    model.subscribe(state => {
      const unsaved = Object.fromEntries(Object.entries(state.drafts).filter(([, draft]) => draft.version !== draft.confirmedVersion).map(([prompt, draft]) => [Number(prompt) + 1, draft.text]));
      roomDrafts.record('reflections', bi('复盘反思', 'Reflections'), unsaved, roomDrafts.current().revision, Object.keys(unsaved).length > 0);
    });
    return model;
  }));
  let prompt = $derived($drafts.prompt), response = $derived($drafts.drafts[prompt]);
  const t = (zh: string, en: string) => $locale === 'zh-CN' ? zh : en;
</script>
<div class="grid grid-cols-2 gap-[13px] max-md:grid-cols-1 max-md:gap-2.5">
  {#each debriefPrompts as question, i}
    <button class="flex items-start gap-[11px] rounded-[9px] border border-line bg-raised p-[18px] text-left text-[12px] leading-[1.8] text-muted aria-pressed:border-border-hover aria-pressed:bg-selected max-md:p-4" aria-pressed={prompt === String(i)} onclick={() => drafts.select(String(i))}><span class="flex size-[23px] shrink-0 items-center justify-center rounded-full border border-line text-[10px]">{i + 1}</span>{question[$locale]}</button>
  {/each}
</div>
<form class="surface mt-6" onsubmit={async (e) => { e.preventDefault(); if ($busy || $connection !== 'live') return; await drafts.submit((prompt, text) => command('reflection', { prompt, text })); }}>
  <label class="mt-0 text-[13px]" for="reflection">{debriefPrompts[Number(prompt)][$locale]}</label>
  <textarea class="max-md:text-[16px]" id="reflection" rows="4" bind:value={() => response.text, drafts.edit} maxlength="2000" required placeholder={t('用自己的话记下一个具体时刻。所有人都能看到你的分享。', 'Describe a specific moment in your own words. Your reflection is shared with everyone.')}></textarea>
  {#if response.pending || response.text}<p class="field-hint" role="status">{response.pending ? t('正在分享提交时的版本…', 'Sharing the submitted version…') : response.version !== response.confirmedVersion ? t('有尚未分享的更改。切题会保留草稿。', 'You have unshared changes. Drafts are kept when switching questions.') : t('此版本已分享，可以继续编辑。', 'This version is shared. You can keep editing.')}</p>{/if}
  <button class="btn primary mt-[18px]" disabled={$busy || $connection !== 'live' || response.pending}><Icon icon={faPaperPlane} size={16} />{t('分享反思', 'Share reflection')}</button>
</form>
<div class="mt-[30px]">
  <h3 class="flex items-center gap-[9px] text-[16px] text-muted"><Icon icon={faComment} size={20} />{t('大家的声音', 'Voices around the table')}</h3>
  {#each Object.entries(game.reflections) as [memberId, responses]}
    {#each Object.entries(responses) as [key, text]}
      <article class="border-b border-line py-[22px]"><strong class="text-[12px] text-muted">{memberName(game, memberId)}</strong><small class="mt-1.5 block text-[10px] text-muted">{debriefPrompts[Number(key)]?.[$locale]}</small><p class="mt-3.5 text-[13px] leading-[1.85] wrap-anywhere whitespace-pre-wrap text-muted">{text}</p></article>
    {/each}
  {:else}<p class="mt-[18px] text-[12px] text-muted">{t('留一点时间思考。第一份分享会出现在这里。', 'Take a moment to think. The first reflection will appear here.')}</p>{/each}
</div>
