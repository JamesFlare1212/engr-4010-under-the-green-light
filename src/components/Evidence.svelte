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
{#if game.evidence.length}
  <div class="mb-[30px] grid grid-cols-3 gap-3.5 max-xl:gap-3 max-lg:grid-cols-1">
    {#each evidence.filter(e => game.evidence.includes(e.id)) as card, i}
      <article class="flex flex-col rounded-[9px] border border-evidence-line bg-evidence px-4 py-5 shadow-[0_3px_0_var(--evidence-line)] max-lg:block max-lg:p-5">
        <div class="flex items-center gap-[7px] text-[9px] text-muted max-md:text-[10px]">
          <span class="flex h-[25px] w-[23px] items-center justify-center bg-evidence-badge font-display text-muted">{String.fromCharCode(65 + i)}</span><span>{card.category[$locale]}</span><Icon icon={faFileLines} size={20} class="ml-auto text-muted" />
        </div>
        <h3 class="mt-[17px] text-[15px] leading-[1.5] font-semibold text-heading max-lg:mt-2.5 max-md:text-[18px]">{card.title[$locale]}</h3>
        <ul class="mt-[15px] mb-5 flex-1 pl-[15px] max-lg:my-3">
          {#each card.facts as fact}<li class="mb-[9px] pl-0.5 text-[14px] leading-[1.9] text-muted max-lg:mb-[5px] max-md:text-[15px]">{fact[$locale]}</li>{/each}
        </ul>
        <div class="flex gap-[7px] border-t border-dashed border-line pt-3.5 text-muted max-lg:pt-3"><Icon icon={faCircleQuestion} size={17} /><p class="text-[12px] leading-[1.7] max-md:text-[13px]">{card.prompt[$locale]}</p></div>
      </article>
    {/each}
  </div>
{:else}
  <div class="px-5 py-[70px] text-center text-muted">
    <Icon icon={faFileLines} size={32} class="mx-auto mb-5" /><h3 class="text-[18px] text-muted">{t('现场记录尚未送达', 'Field records are on their way')}</h3><p class="mx-auto mt-3 max-w-[440px] text-[13px]">{t('进入调查阶段后，三份关键证据将自动共享给所有人。', 'All three essential records are shared automatically when investigation begins.')}</p>
  </div>
{/if}
