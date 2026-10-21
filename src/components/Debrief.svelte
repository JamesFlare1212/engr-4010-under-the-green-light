<script lang="ts">
  import { MessageCircle, Send } from 'lucide-svelte';
  import type { RoomView } from '../../shared/types';
  import { debriefPrompts } from '../../shared/content';
  import { locale } from '../lib/i18n';
  import { command, busy, connection } from '../lib/client';
  let { game }: { game: RoomView } = $props();
  let prompt = $state('0'), response = $state('');
  const t = (zh: string, en: string) => $locale === 'zh-CN' ? zh : en;
</script>
<div class="reflection-prompts">{#each debriefPrompts as question, i}<button class:chosen={prompt === String(i)} aria-pressed={prompt === String(i)} onclick={() => { prompt = String(i); response = game.reflections[game.me]?.[prompt] ?? ''; }}><span>{i + 1}</span>{question[$locale]}</button>{/each}</div>
<form class="surface reflection-form" onsubmit={async (e) => { e.preventDefault(); if (await command('reflection', { prompt, text: response })) response = ''; }}><label for="reflection">{debriefPrompts[Number(prompt)][$locale]}</label><textarea id="reflection" rows="4" bind:value={response} maxlength="2000" required placeholder={t('用自己的话记下一个具体时刻。所有人都能看到你的分享。', 'Describe a specific moment in your own words. Your reflection is shared with everyone.')}></textarea><button class="btn primary" disabled={$busy || $connection !== 'live'}><Send size={16} />{t('分享反思', 'Share reflection')}</button></form>
<div class="shared-reflections"><h3><MessageCircle size={20} />{t('大家的声音', 'Voices around the table')}</h3>{#each Object.entries(game.reflections) as [memberId, responses]}{#each Object.entries(responses) as [key, text]}<article><strong>{game.members.find(m => m.id === memberId)?.name}</strong><small>{debriefPrompts[Number(key)]?.[$locale]}</small><p class="[overflow-wrap:anywhere]">{text}</p></article>{/each}{:else}<p class="muted">{t('留一点时间思考。第一份分享会出现在这里。', 'Take a moment to think. The first reflection will appear here.')}</p>{/each}</div>
