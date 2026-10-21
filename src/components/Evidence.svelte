<script lang="ts">
  import Icon from './Icon.svelte';
  import { faCircleQuestion, faEye, faFileLines } from '@fortawesome/free-solid-svg-icons';
  import type { RoomView } from '../../shared/types';
  import { evidence } from '../../shared/content';
  import { locale } from '../lib/i18n';
  let { game, inline = false }: { game: RoomView; inline?: boolean } = $props();
  const t = (zh: string, en: string) => $locale === 'zh-CN' ? zh : en;
</script>
{#if !inline}<div class="section-title"><div><h2>{t('共享证据', 'Shared evidence')}</h2><p>{t('一次发现，始终可查。失败的检定不会删除关键线索。', 'Discover once, consult anytime. Failed checks never remove essential evidence.')}</p></div><span class="pill"><Icon icon={faEye} size={14} />{game.evidence.length} / 3</span></div>{/if}
{#if game.evidence.length}<div class="evidence-grid">{#each evidence.filter(e => game.evidence.includes(e.id)) as card, i}<article class="evidence-card"><div class="evidence-top"><span class="file-letter">{String.fromCharCode(65 + i)}</span><span>{card.category[$locale]}</span><Icon icon={faFileLines} size={20} /></div><h3>{card.title[$locale]}</h3><ul>{#each card.facts as fact}<li>{fact[$locale]}</li>{/each}</ul><div class="evidence-prompt"><Icon icon={faCircleQuestion} size={17} /><p>{card.prompt[$locale]}</p></div></article>{/each}</div>{:else}<div class="empty-state"><Icon icon={faFileLines} size={32} /><h3>{t('现场记录尚未送达', 'Field records are on their way')}</h3><p>{t('进入调查阶段后，三份关键证据将自动共享给所有人。', 'All three essential records are shared automatically when investigation begins.')}</p></div>{/if}
