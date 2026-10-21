<script lang="ts">
  import Icon from './Icon.svelte';
  import { faArrowRight, faArrowRotateLeft, faBriefcaseMedical, faCheck, faDiceD20, faHand, faShieldHalved, faUsers } from '@fortawesome/free-solid-svg-icons';
  import type { RoomView, Objective, Check } from '../../shared/types';
  import { objectives } from '../../shared/types';
  import { objectiveLabels, prepareLabels, planPresets, backups, displayPlan, baseDC, outcomes, tierLabels, preparationOutcomes } from '../../shared/content';
  import { locale } from '../lib/i18n';
  import { command, busy, connection } from '../lib/client';
  import { untrack } from 'svelte';
  let { game, gm = false }: { game: RoomView; gm?: boolean } = $props();
  let target = $state<Objective>('access'), action = $state(untrack(() => game.route === 'quiet_water' ? 'access-boat' : game.route === 'borrowed_channel' ? 'access-gate' : 'access-anchor')), backup = $state('backup-manual');
  let customAction = $state(''), customBackup = $state(''), bonus = $state(2), bonusReason = $state(''), creative = $state(0), supportId = $state('');
  let die = $state<number | undefined>(undefined), correctionDie = $state<number | undefined>(undefined), correctionReason = $state(''), narrative = $state('');
  let animating = $state(false);
  const kind = $derived(game.phase === 'investigation' ? 'preparation' : 'execution');
  const available = $derived(objectives.filter(o => !game.checks.some(c => c.kind === kind && c.objective === o)));
  const active = $derived(game.checks.find(c => c.status !== 'resolved'));
  const latest = $derived(game.checks.filter(c => c.kind === kind && c.result).at(-1));
  const rolledAt = $derived(latest?.result?.rolledAt ?? 0);
  const pendingPoll = $derived(game.polls.some(p => p.status === 'open' || (p.tied.length && !p.outcome)));
  const locked = $derived($busy || $connection !== 'live');
  const me = $derived(game.members.find(m => m.id === game.me)!);
  const prepared = $derived(game.checks.some(c => c.kind === 'preparation' && c.objective === target && c.result && ['success', 'boon'].includes(c.result.tier)));
  const dc = $derived((kind === 'preparation' ? 11 : baseDC[target]) - (kind === 'execution' ? Math.max(prepared ? 2 : 0, creative) : 0));
  const t = (zh: string, en: string) => $locale === 'zh-CN' ? zh : en;
  const memberName = (id: string | null) => game.members.find(m => m.id === id)?.name ?? t('待选', 'Pending');
  $effect(() => {
    if (available.length && !available.includes(target)) {
      target = available[0];
      backup = target === 'evacuation' ? 'backup-refuge' : target === 'isolation' ? 'backup-cordon' : 'backup-manual';
    }
    if (!planPresets[target].some(p => p.id === action) && action !== 'custom') {
      action = target === 'access' && game.route === 'quiet_water' ? 'access-boat' : target === 'access' && game.route === 'borrowed_channel' ? 'access-gate' : planPresets[target][0].id;
    }
  });
  $effect(() => {
    if (rolledAt) {
      animating = untrack(() => game.settings.dice) === 'virtual' && Date.now() - rolledAt < 2500;
      const timer = setTimeout(() => animating = false, 700);
      return () => clearTimeout(timer);
    }
  });
  async function open(event: SubmitEvent) {
    event.preventDefault();
    if (await command('open_check', { objective: target, action: action === 'custom' ? customAction : action, backup: backup === 'custom' ? customBackup : backup, bonus, bonusReason, creative, supportId: supportId || null })) { die = undefined; narrative = ''; }
  }
  const outcomeFor = (check: Check) => check.result ? (check.kind === 'preparation' ? preparationOutcomes[check.result.tier] : outcomes[check.objective][check.result.tier])[$locale] : '';
</script>

<div class="objective-progress">{#each objectives as objective}{@const check = game.checks.find(c => c.kind === kind && c.objective === objective)}<div class:objective-done={check?.result} class:objective-active={active?.objective === objective}><span>{#if check?.result}<Icon icon={faCheck} size={15} />{:else}{objectives.indexOf(objective) + 1}{/if}</span><strong>{(kind === 'preparation' ? prepareLabels : objectiveLabels)[objective][$locale]}</strong><small>{check?.result ? tierLabels[check.result.tier][$locale] : `DC ${kind === 'preparation' ? 11 : baseDC[objective]}`}</small></div>{/each}</div>
{#if active}
  <section class="check-panel">
    <div class="panel-heading"><span class="icon-well"><Icon icon={faDiceD20} size={21} /></span><div><h3>{(kind === 'preparation' ? prepareLabels : objectiveLabels)[active.objective][$locale]}</h3><p>{t('行动与难度已公开。先分工，再掷骰。', 'The plan and DC are public. Assign the lead before rolling.')}</p></div><span class="dc-badge">DC {(active.kind === 'preparation' ? 11 : baseDC[active.objective]) - Math.max(active.preparation, active.creative)}</span></div>
    <dl class="action-brief"><div><dt>{t('行动', 'Action')}</dt><dd>{displayPlan(active.action)[$locale]}</dd></div><div><dt>{t('备用', 'Backup')}</dt><dd>{displayPlan(active.backup)[$locale]}</dd></div><div><dt>{t('依据', 'Basis')}</dt><dd>+{active.bonus} {active.bonusReason}{#if Math.max(active.preparation, active.creative)}<span class="mini-benefit">DC −{Math.max(active.preparation, active.creative)}</span>{/if}</dd></div></dl>
    {#if active.status === 'recruiting'}
      <div class="recruit-heading"><Icon icon={faHand} size={23} /><div><h4>{t('谁来主导这次行动？', 'Who will lead this action?')}</h4><p>{t('每位玩家选择申请或本轮协助；多人申请时随机抽选一位。', 'Volunteer or support this round. Several volunteers enter a random draw for one lead.')}</p></div></div>
      <div class="applicant-list">{#each active.eligible as id}<div class:applied={active.responses[id] === true}><span class="avatar small">{memberName(id).slice(0, 1)}</span><span>{memberName(id)}<small>{active.responses[id] === true ? t('已申请', 'Volunteered') : active.responses[id] === false ? t('本轮协助', 'Supporting') : t('等待回应', 'Waiting')}</small></span>{#if active.responses[id] === true}<Icon icon={faHand} size={16} />{/if}</div>{/each}</div>
      {#if me.role === 'player' && active.eligible.includes(me.id)}<div class="recruit-actions"><button class="btn primary" disabled={locked} aria-pressed={active.responses[me.id] === true} onclick={() => command('volunteer', { checkId: active.id, willing: true })}><Icon icon={faHand} size={17} />{active.responses[me.id] ? t('已申请 · 点击仍可确认', 'Volunteered · confirm') : t('我来申请', 'Volunteer to lead')}</button><button class="btn secondary" disabled={locked} aria-pressed={active.responses[me.id] === false} onclick={() => command('volunteer', { checkId: active.id, willing: false })}>{t('本轮协助', 'Support this round')}</button></div>{/if}
      {#if gm}<div class="gm-check-actions"><p>{t('全员回应后自动抽选；离线成员不回应时，可从已有申请者中抽选。', 'The draw runs when everyone responds. If someone is offline, draw from current volunteers.')}</p><button class="btn secondary" disabled={locked || !Object.values(active.responses).some(Boolean)} onclick={() => command('select_lead', { checkId: active.id })}>{t('从申请者中随机抽选', 'Draw a random volunteer')}<Icon icon={faArrowRight} size={16} /></button></div>{/if}
    {:else}
      <div class="selected-lead"><div class="die-outline"><Icon icon={faDiceD20} size={36} /></div><span class="tiny-tag">{t('系统抽选的主导人', 'The selected lead')}</span><h3>{memberName(active.leadId)}</h3>{#if active.supportId}<p><Icon icon={faUsers} size={16} />{t('行动搭档：', 'Partner: ')}{memberName(active.supportId)}</p>{/if}
        {#if game.settings.dice === 'virtual'}
          {#if me.id === active.leadId}<button class="btn primary roll-button" disabled={locked} onclick={() => command('roll', { checkId: active.id })}><Icon icon={faDiceD20} size={21} />{t('掷出 D20', 'Roll the D20')}</button>{:else}<p class="field-hint">{t('等待主导人掷骰，结果将自动同步。', 'Waiting for the selected lead to roll. The result will sync automatically.')}</p>{/if}
        {:else if gm}
          <form class="physical-roll" onsubmit={async (e) => { e.preventDefault(); if (await command('roll', { checkId: active.id, die })) die = undefined; }}><label for="physical-die">{t('请主导人掷实体骰，GM 录入点数', 'Ask the lead to roll a physical die; a GM enters the result')}</label><div><input id="physical-die" type="number" inputmode="numeric" min="1" max="20" step="1" bind:value={die} required placeholder="1–20" /><button class="btn primary" disabled={locked}>{t('确认点数', 'Confirm roll')}</button></div></form>
        {:else}<p>{t('请掷实体 D20，并让 GM 输入点数。', 'Roll the physical D20 and ask a GM to enter the result.')}</p>{/if}
      </div>
    {/if}
    {#if gm}<details class="gm-details"><summary><Icon icon={faArrowRotateLeft} size={14} />{t('处理断线或更换主导', 'Handle a disconnect or change the lead')}</summary><p>{t('重新申请将清除本轮回应，原主导人无法再掷骰。已公布的行动和 DC 保持有效。', 'Reopening clears this round’s responses and revokes the previous lead’s roll permission. The published plan and DC stay in effect.')}</p><button class="btn secondary" disabled={locked} onclick={() => command('recruit_again', { checkId: active.id })}>{t('重新开放申请', 'Reopen recruitment')}</button></details>{/if}
  </section>
{:else}
  {#if latest?.result}
    <section class="result-panel" class:result-success={['success', 'boon'].includes(latest.result.tier)} aria-live="polite">
      <div class="result-main"><div class="result-die select-none" class:rolling={animating}><Icon icon={faDiceD20} size={64} /><strong>{latest.result.die}</strong></div><div><span class="tiny-tag">{objectiveLabels[latest.objective][$locale]} · {memberName(latest.leadId)}</span><h3>{tierLabels[latest.result.tier][$locale]}</h3><p class="roll-equation"><span>{latest.result.die}</span> + {latest.bonus} = <strong>{latest.result.total}</strong><span class="equation-divider">/</span>DC {latest.result.dc}<span class="delta">Δ {latest.result.delta >= 0 ? '+' : ''}{latest.result.delta}</span></p></div></div>
      <p class="outcome-narrative">{outcomeFor(latest)}</p>
      {#if latest.result.kitSpent}<div class="kit-used"><Icon icon={faBriefcaseMedical} size={17} />{t('已使用 1 份物资：', 'Used 1 kit: ')}{tierLabels[latest.result.rawTier][$locale]}<Icon icon={faArrowRight} size={14} />{tierLabels[latest.result.tier][$locale]}</div>{/if}
      {#if latest.narrative}<p class="gm-fiction [overflow-wrap:anywhere]">{latest.narrative}</p>{/if}
      {#if gm && latest.kind === 'execution' && latest.result.delta < 0 && !latest.result.kitSpent && game.emergencyKits > 0 && !pendingPoll && !game.polls.some(p => p.kind === 'kit' && p.checkId === latest.id)}<button class="btn secondary" disabled={locked} onclick={() => command('kit_vote', { checkId: latest.id })}><Icon icon={faBriefcaseMedical} size={16} />{t('投票决定补救', 'Vote on using a kit')}</button>{/if}
      {#if gm}
        <details class="gm-details"><summary>{t('补充实际后果 / 更正骰点', 'Add fictional consequences / correct the die')}</summary>
          <form onsubmit={async (e) => { e.preventDefault(); if (await command('narrative', { checkId: latest.id, narrative })) narrative = ''; }}><label for="outcome-text">{t('追加公开叙述', 'Additional public narrative')}</label><textarea id="outcome-text" bind:value={narrative} maxlength="3000" required placeholder={latest.narrative || t('写下团队实际采取的备用安排与代价', 'Record the team’s actual backup arrangements and costs')}></textarea><button class="btn secondary" disabled={locked}>{t('保存叙述', 'Save narrative')}</button></form>
          <form onsubmit={async (e) => { e.preventDefault(); if (await command('correct_die', { checkId: latest.id, die: correctionDie, reason: correctionReason })) { correctionDie = undefined; correctionReason = ''; } }}><p class="field-hint">{t('更正将退回此行动用过的物资，并用原先的难度重新计算。原因会公开记录。', 'A correction refunds this action’s kit and recalculates with the original DC. The reason is recorded publicly.')}</p><div class="form-row"><div><label for="corrected-die">D20</label><input id="corrected-die" type="number" min="1" max="20" step="1" required bind:value={correctionDie} /></div><div><label for="corrected-reason">{t('更正原因', 'Reason')}</label><input id="corrected-reason" bind:value={correctionReason} maxlength="500" required /></div></div><button class="btn secondary" disabled={locked || pendingPoll}>{t('记录更正并重算', 'Record correction and recalculate')}</button></form>
        </details>
      {/if}
    </section>
  {/if}
  {#if available.length && gm && !pendingPoll}
    <section class="prepare-check surface"><div class="panel-heading"><span class="icon-well"><Icon icon={faShieldHalved} size={21} /></span><div><h3>{t('确认下一项行动', 'Set up the next action')}</h3><p>{t('从预设开始，按团队讨论补充依据。', 'Start with a preset and add the team’s reasoning.')}</p></div><span class="dc-badge">DC {dc}</span></div>
      <form onsubmit={open}>
        <label for="check-target">{t('目标 · 可以调整顺序', 'Objective · order is flexible')}</label><select id="check-target" bind:value={target}>{#each available as objective}<option value={objective}>{(kind === 'preparation' ? prepareLabels : objectiveLabels)[objective][$locale]}</option>{/each}</select>
        <label for="check-action">{t('行动方案', 'Action plan')}</label><select id="check-action" bind:value={action}>{#each planPresets[target] as plan}<option value={plan.id}>{plan.label[$locale]}</option>{/each}<option value="custom">{t('填写自己的行动', 'Write a custom action')}</option></select>{#if action === 'custom'}<label for="custom-action" class="sr-only">{t('自定义行动', 'Custom action')}</label><textarea id="custom-action" bind:value={customAction} maxlength="2000" required></textarea>{/if}
        <label for="check-backup">{t('备用方案', 'Contingency plan')}</label><select id="check-backup" bind:value={backup}>{#each backups as b}<option value={b.id}>{b.label[$locale]}</option>{/each}<option value="custom">{t('填写自己的备用安排', 'Write a custom contingency')}</option></select>{#if backup === 'custom'}<label class="sr-only" for="custom-backup">{t('自定义备用安排', 'Custom contingency')}</label><textarea id="custom-backup" bind:value={customBackup} maxlength="2000" required></textarea>{/if}
        <div class="form-row"><div><label for="check-bonus">{t('一项相关加成', 'One relevant bonus')}</label><select id="check-bonus" bind:value={bonus}><option value={0}>{t('无加成 +0', 'No bonus +0')}</option><option value={1}>{t('工具 +1', 'Tool +1')}</option><option value={2}>{t('工程 +2', 'Engineering +2')}</option><option value={3}>{t('领导力 +3', 'Leadership +3')}</option></select></div>{#if kind === 'execution'}<div><label for="check-creative">{t('具体创意降 DC', 'Creative DC reduction')}</label><select id="check-creative" bind:value={creative}><option value={0}>0</option><option value={1}>−1</option><option value={2}>−2</option></select></div>{/if}</div>
        <label for="bonus-reason">{t('加成 / 创意依据（选填）', 'Reason for bonus / creative reduction (optional)')}</label><input id="bonus-reason" bind:value={bonusReason} maxlength="500" placeholder={t('例如：使用手摇绞盘，先由 Mira 验证锚点', 'For example: use the hand winch; Mira verifies the anchor')} />
        {#if kind === 'execution' && game.settings.mode === 'short'}<label for="support-id">{t('行动搭档', 'Action partner')}</label><select id="support-id" bind:value={supportId}><option value="">{t('系统优先安排未主导的玩家', 'Prefer a player who has not led')}</option>{#each game.members.filter(m => m.role === 'player') as m}<option value={m.id}>{m.name} ({m.leads})</option>{/each}</select>{/if}
        <div class="check-form-foot"><p>{prepared && kind === 'execution' ? t('已有准备优势 −2；与创意取较高者。', 'Preparation gives −2 DC; use the greater reduction.') : t('难度在申请前公开，掷骰后固定。', 'The DC is public before recruitment and fixed after rolling.')}</p><button class="btn primary" disabled={locked}><Icon icon={faHand} size={17} />{t('公布行动，开放申请', 'Publish plan & invite volunteers')}</button></div>
      </form>
    </section>
  {:else if available.length && !gm && !pendingPoll}<div class="waiting-state">{@render RadioIcon()}<p>{t('主持人正在确认下一项行动。你可以回看证据，与同伴讨论备用方案。', 'Your GM is setting up the next action. Review the evidence and discuss contingencies together.')}</p></div>{/if}
{/if}
{#if game.checks.filter(c => c.kind === kind && c.result && c.id !== latest?.id).length}<details class="previous-checks"><summary>{t('查看此前检定', 'Review earlier checks')}</summary>{#each game.checks.filter(c => c.kind === kind && c.result && c.id !== latest?.id) as check}<article><strong>{objectiveLabels[check.objective][$locale]} · {tierLabels[check.result!.tier][$locale]}</strong><p>D20 {check.result!.die} + {check.bonus} = {check.result!.total} / DC {check.result!.dc}</p><p>{outcomeFor(check)}</p>{#if check.narrative}<p>{check.narrative}</p>{/if}</article>{/each}</details>{/if}

{#snippet RadioIcon()}<span class="signal-dot"></span>{/snippet}
