<script lang="ts">
  import Icon from './Icon.svelte';
  import { faCheck, faCodeBranch, faDiceD20 } from '@fortawesome/free-solid-svg-icons';
  import { phases, type RoomView } from '../../shared/types';
  import { phaseLabels, routes, objectiveLabels, tierLabels } from '../../shared/content';
  import { locale } from '../lib/i18n';
  let { game }: { game: RoomView } = $props();
  const t = (zh: string, en: string) => $locale === 'zh-CN' ? zh : en;
  const current = $derived(phases.indexOf(game.phase));
</script>
<div class="section-title"><div><h2>{t('每个决定，都留下路径', 'Every decision leaves a path')}</h2><p>{t('查看当前进度、路线分叉与已结算后果。', 'Follow the current stage, route branches and resolved consequences.')}</p></div><Icon icon={faCodeBranch} size={23} /></div>
<ol class="mx-auto my-[35px] max-w-[720px] list-none p-0 max-md:mx-0 max-md:my-[30px]">
  {#each phases as phase, i}
    <li class={['relative ml-3.5 border-l-2 pb-7 pl-[25px] last:border-l-transparent max-md:ml-[13px] max-md:pl-[22px]', current > i ? 'border-l-border-hover' : 'border-l-line']}>
      <div class="flex min-h-10 items-center gap-[13px] text-[14px] text-muted max-md:text-[13px]">
        <span class={['absolute -left-[17px] flex size-[31px] items-center justify-center rounded-full border text-[11px]', game.phase === phase ? 'border-active bg-active text-on-accent shadow-[0_0_0_5px_var(--badge)]' : current > i ? 'border-border-hover bg-badge text-muted' : 'border-line bg-paper text-muted']}>{#if current > i}<Icon icon={faCheck} size={17} />{:else}{i + 1}{/if}</span>
        <strong class="ml-1 font-[550]">{phaseLabels[phase][$locale]}</strong>{#if phase === game.phase}<span class="pill ml-auto text-[9px] max-md:text-[8px]">{t('当前位置', 'You are here')}</span>{/if}
      </div>
      {#if phase === 'investigation'}<p class="pt-1.5 pl-1 text-[10px] text-muted max-md:leading-[1.8]">{game.settings.mode === 'full' ? t('3 次准备检定 → 对应执行最多降 DC 2', '3 preparation checks → up to −2 DC for each objective') : t('精简版：共享三份证据，跳过准备骰', 'Short mode: share all evidence and skip preparation rolls')}</p>{/if}
      {#if phase === 'route_choice'}
        <div class="mx-[10%] mt-[5px] h-4 rounded-t-[7px] border border-b-0 border-line"></div>
        <div class="grid grid-cols-4 gap-[9px] pt-[9px] pb-[7px] max-md:grid-cols-2 max-md:gap-[7px]">
          {#each routes as route}<div class={['flex flex-wrap items-center gap-1.5 rounded-md border px-2 py-3 text-[10px] text-muted max-md:px-2.5', game.route === route.id ? 'border-border-hover bg-badge' : 'border-line bg-raised']}><span class="font-display text-[12px] text-muted">{route.label}</span><strong class="flex-1 text-[10px] font-medium">{route.title[$locale]}</strong>{#if game.route === route.id}<Icon icon={faCheck} size={15} />{/if}</div>{/each}
        </div>
        <p class="pt-1.5 pl-1 text-[10px] text-muted max-md:leading-[1.8]">{t('投票 → 唯一领先者；平票 → 讨论与 GM 裁决', 'Vote → a unique winner; tie → discussion and GM decision')}</p>
      {/if}
      {#if phase === 'execution'}
        <div class="mt-[15px] flex flex-col gap-2">
          {#each ['access', 'evacuation', 'isolation'] as objective}
            {@const check = game.checks.find(c => c.kind === 'execution' && c.objective === objective)}
            <div class={['flex items-center gap-2 rounded-md border border-line px-3.5 py-3 text-[11px] text-muted max-md:flex-wrap', check?.result ? 'bg-selected' : 'bg-raised']}><Icon icon={faDiceD20} size={16} /><span class="flex-1">{objectiveLabels[objective as keyof typeof objectiveLabels][$locale]}</span><small class="text-[9px]">{check?.result ? tierLabels[check.result.tier][$locale] : t('待行动', 'Pending')}</small>{#if check?.result?.kitSpent}<small class="text-[9px]">+ {t('物资补救', 'Kit')}</small>{/if}</div>
          {/each}
        </div>
        <div class="mt-[9px] flex items-center gap-2 rounded-[5px] bg-soft px-3.5 py-2.5 text-[10px] text-muted max-md:items-start max-md:leading-[1.8]"><Icon icon={faCodeBranch} size={15} />{t('失败 → 预置备用方案 → 继续下一目标', 'Setback → prepared backup → next objective')}</div>
      {/if}
    </li>
  {/each}
</ol>
<div class="mt-10 border-t border-line pt-[25px]">
  <h3 class="mb-5 text-[15px] text-muted">{t('已做出的决定', 'Decisions made')}</h3>
  {#each game.polls.filter(p => p.outcome) as poll}<div class="flex items-start gap-3 py-[13px] text-muted"><Icon icon={faCheck} size={15} /><p class="text-[11px] text-muted">{poll.question[$locale]}<strong class="mt-1 block text-[12px] font-medium text-muted">{poll.options.find(o => o.id === poll.outcome)?.label[$locale]}</strong></p></div>{:else}<p class="text-[11px] text-muted">{t('团队决定会在投票结束后显示在这里。', 'Team decisions appear here after each vote closes.')}</p>{/each}
</div>
