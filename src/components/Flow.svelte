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
<ol class="flow-chart">{#each phases as phase, i}<li class:flow-current={game.phase === phase} class:flow-done={current > i}>
  <div class="flow-node"><span class="flow-mark">{#if current > i}<Icon icon={faCheck} size={17} />{:else}{i + 1}{/if}</span><strong>{phaseLabels[phase][$locale]}</strong>{#if phase === game.phase}<span class="pill">{t('当前位置', 'You are here')}</span>{/if}</div>
  {#if phase === 'investigation'}<p class="flow-note">{game.settings.mode === 'full' ? t('3 次准备检定 → 对应执行最多降 DC 2', '3 preparation checks → up to −2 DC for each objective') : t('精简版：共享三份证据，跳过准备骰', 'Short mode: share all evidence and skip preparation rolls')}</p>{/if}
  {#if phase === 'route_choice'}<div class="branch-line"></div><div class="route-branches">{#each routes as route}<div class="branch" class:branch-selected={game.route === route.id}><span>{route.label}</span><strong>{route.title[$locale]}</strong>{#if game.route === route.id}<Icon icon={faCheck} size={15} />{/if}</div>{/each}</div><p class="flow-note">{t('投票 → 唯一领先者；平票 → 讨论与 GM 裁决', 'Vote → a unique winner; tie → discussion and GM decision')}</p>{/if}
  {#if phase === 'execution'}<div class="flow-checks">{#each ['access', 'evacuation', 'isolation'] as objective}{@const check = game.checks.find(c => c.kind === 'execution' && c.objective === objective)}<div class:resolved={check?.result}><Icon icon={faDiceD20} size={16} /><span>{objectiveLabels[objective as keyof typeof objectiveLabels][$locale]}</span><small>{check?.result ? tierLabels[check.result.tier][$locale] : t('待行动', 'Pending')}</small>{#if check?.result?.kitSpent}<small>+ {t('物资补救', 'Kit')}</small>{/if}</div>{/each}</div><div class="flow-fallback"><Icon icon={faCodeBranch} size={15} />{t('失败 → 预置备用方案 → 继续下一目标', 'Setback → prepared backup → next objective')}</div>{/if}
</li>{/each}</ol>
<div class="decision-history"><h3>{t('已做出的决定', 'Decisions made')}</h3>{#each game.polls.filter(p => p.outcome) as poll}<div><Icon icon={faCheck} size={15} /><p>{poll.question[$locale]}<strong>{poll.options.find(o => o.id === poll.outcome)?.label[$locale]}</strong></p></div>{:else}<p class="muted">{t('团队决定会在投票结束后显示在这里。', 'Team decisions appear here after each vote closes.')}</p>{/each}</div>
