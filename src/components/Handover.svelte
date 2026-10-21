<script lang="ts">
  import { untrack } from 'svelte';
  import { Users, ShieldCheck, Radio, FileDown, Pencil, Save, RefreshCw, ClipboardCheck } from 'lucide-svelte';
  import type { RoomView, Report, Tracks } from '../../shared/types';
  import { tracks, isolationLabels, clinicLabels, routes } from '../../shared/content';
  import { locale } from '../lib/i18n';
  import { command, busy, connection, download } from '../lib/client';
  let { game, gm = false }: { game: RoomView; gm?: boolean } = $props();
  let editing = $state(false), draft = $state<Report>(untrack(() => ({ ...game.report }))), editRevision = $state(untrack(() => game.revision));
  let adjust = $state<Tracks>(untrack(() => tracks(game))), reason = $state('');
  const result = $derived(tracks(game));
  const locked = $derived($busy || $connection !== 'live');
  const t = (zh: string, en: string) => $locale === 'zh-CN' ? zh : en;
  const truthLabels = {
    unreviewed: { 'zh-CN': '待共同核对', en: 'Awaiting review' }, accurate: { 'zh-CN': '如实披露', en: 'Accurate disclosure' },
    incomplete: { 'zh-CN': '信息不完整', en: 'Incomplete disclosure' }, misleading: { 'zh-CN': '存在误导', en: 'Misleading statement' }
  };
  const fields = ['observations', 'uncertainty', 'owner', 'nextUpdate', 'restrictions', 'backup', 'statement'] as const;
  const labels = {
    observations: { 'zh-CN': '已验证的观察与人数', en: 'Verified observations & headcount' },
    uncertainty: { 'zh-CN': '尚未验证 / 不确定的事项', en: 'Unverified items / uncertainty' },
    owner: { 'zh-CN': '下一步具名负责人', en: 'Named next-action owner' },
    nextUpdate: { 'zh-CN': '下次更新时间', en: 'Next update time' },
    restrictions: { 'zh-CN': '限制与禁入范围', en: 'Restrictions & exclusion zones' },
    backup: { 'zh-CN': '备用安排与医疗交接', en: 'Backup arrangements & clinical handover' },
    statement: { 'zh-CN': '实际对外通报原话', en: 'Actual public statement' }
  };
  function beginEdit() { draft = { ...game.report }; editRevision = game.revision; editing = true; }
  function reportText() {
    const route = routes.find(r => r.id === game.route);
    return [t('绿灯之下 · 事故交接', 'Under the Green Light · Incident handover'), `${t('房间', 'Room')}: ${game.code}`, `${t('路线', 'Route')}: ${route?.title[$locale] ?? ''}`, route?.id === 'custom' ? game.customRoute.plan : route?.method[$locale], `${t('公开代价', 'Accepted costs')}: ${route?.id === 'custom' ? game.customRoute.costs : route?.costs.map(c => c[$locale]).join(' / ')}`, ...fields.map(f => `${labels[f][$locale]}: ${game.report[f]}`), `${t('通报核对', 'Statement review')}: ${truthLabels[game.report.truthfulness][$locale]}`, `${result.evacuated}/12 ${t('已撤离', 'evacuated')}; ${result.waiting} ${t('待援', 'awaiting rescue')}; ${result.observation} ${t('需观察', 'need observation')}`, `${isolationLabels[result.isolation][$locale]}. ${clinicLabels[result.clinic][$locale]}.`, ...game.checks.filter(c => c.kind === 'execution' && c.result).map(c => `${c.objective}: D20 ${c.result!.die} + ${c.bonus} / DC ${c.result!.dc}; ${c.result!.rawTier} → ${c.result!.tier}; kit=${c.result!.kitSpent}. ${c.narrative}`), game.overrideReason ? `${t('叙事调整', 'Fictional adjustment')}: ${game.overrideReason}` : ''].filter(Boolean).join('\n\n');
  }
</script>
<div class="ending-tracks"><article><Users size={23} /><h3>{t('人员', 'People')}</h3><strong>{result.evacuated}<small>/ 12</small></strong><p>{t('人已撤离', 'people evacuated')}</p><span>{t(`${result.waiting} 人待援 · ${result.observation} 人需观察`, `${result.waiting} awaiting rescue · ${result.observation} need observation`)}</span></article><article><ShieldCheck size={23} /><h3>{t('设施', 'Facilities')}</h3><h4>{isolationLabels[result.isolation][$locale]}</h4><p>{clinicLabels[result.clinic][$locale]}</p></article><article><Radio size={23} /><h3>{t('通报', 'Statement')}</h3><h4>{truthLabels[game.report.truthfulness][$locale]}</h4><p>{t('按实际表达核对，独立于骰点。', 'Review the actual words, independently of dice totals.')}</p></article></div>
{#if game.route}{@const route = routes.find(r => r.id === game.route)!}<div class="accepted-costs"><h3>{t('保留的路线代价', 'Accepted route costs')} · {route.title[$locale]}</h3><ul>{#if route.id === 'custom'}<li>{game.customRoute.costs}</li>{:else}{#each route.costs as cost}<li>{cost[$locale]}</li>{/each}{/if}</ul></div>{/if}
<section class="report-section surface"><div class="section-title"><div><h3>{t('把下一步交给一个具体的人', 'Give the next action to a named person')}</h3><p>{t('所有成员都可以共同填写交接，未完成的内容可以先保存为草稿。', 'Everyone in the room can contribute to the handover and save unfinished drafts.')}</p></div><div class="button-group"><button class="btn secondary" onclick={() => download(reportText(), `handover-${game.code}.txt`, 'text/plain')}><FileDown size={16} />{t('导出交接', 'Export handover')}</button>{#if !editing}<button class="btn primary" disabled={locked} onclick={beginEdit}><Pencil size={15} />{t('编辑', 'Edit')}</button>{/if}</div></div>
  {#if !editing}<button class="btn secondary" disabled={locked} onclick={() => command('report_preset', { locale: $locale })}><ClipboardCheck size={16} />{t('按当前事实生成通报草稿', 'Draft a statement from current facts')}</button><p class="field-hint">{t('会替换现有草稿文字；负责人和更新时间由团队填写，真实性仍需核对。', 'Replaces the current draft text. The team supplies the owner and update time and reviews accuracy.')}</p>{/if}
  {#if editing}<form onsubmit={async (e) => { e.preventDefault(); if (await command('report', { ...draft }, editRevision)) editing = false; }}>
    {#if game.revision !== editRevision}<div class="edit-conflict"><p>{t('房间有新进度。保存前请核对当前报告；你的草稿仍保留。', 'The room has changed. Review the current report before saving; your draft is retained.')}</p><button type="button" class="btn secondary" onclick={() => editRevision = game.revision}>{t('已核对，保留草稿', 'Reviewed; keep my draft')}</button><button type="button" class="btn ghost" onclick={beginEdit}>{t('重新读取报告', 'Reload the report')}</button></div>{/if}
    {#each fields as field}<label for={`report-${field}`}>{labels[field][$locale]}</label>{#if field === 'owner' || field === 'nextUpdate'}<input id={`report-${field}`} bind:value={draft[field]} maxlength="200" />{:else}<textarea id={`report-${field}`} bind:value={draft[field]} maxlength="3000" rows={field === 'statement' ? 4 : 2}></textarea>{/if}{/each}
    <label for="truthfulness">{t('通报核对（人工确认）', 'Statement review (human judgment)')}</label><select id="truthfulness" bind:value={draft.truthfulness}>{#each Object.entries(truthLabels) as [value, label]}<option {value}>{label[$locale]}</option>{/each}</select><div class="form-buttons"><button class="btn secondary" type="button" onclick={() => editing = false}>{t('取消', 'Cancel')}</button><button class="btn primary" disabled={locked || game.revision !== editRevision}><Save size={16} />{t('保存交接', 'Save handover')}</button></div>
  </form>{:else}<dl class="report-fields">{#each fields as field}<div><dt>{labels[field][$locale]}</dt><dd>{game.report[field] || t('待团队填写', 'Awaiting the team’s input')}</dd></div>{/each}</dl>{/if}
</section>
{#if gm}<details class="gm-details surface"><summary><Pencil size={15} />{t('GM：调整实际叙事结果', 'GM: adjust fictional outcomes')}</summary><p>{t('用来记录团队实际安排；不改写原始骰点。人员、隔离和医疗保障分别记录。', 'Record the team’s fictional arrangements without rewriting dice. Track people, isolation and clinical safeguards separately.')}</p><button class="btn ghost" onclick={() => adjust = { ...result }}>{t('读取当前结果', 'Load current outcomes')}</button><form onsubmit={(e) => { e.preventDefault(); command('override_tracks', { ...adjust, reason }); }}><div class="form-row">{#each ['evacuated', 'waiting', 'observation'] as field}<div><label for={`adjust-${field}`}>{field === 'evacuated' ? t('已撤离', 'Evacuated') : field === 'waiting' ? t('待援', 'Waiting') : t('需观察', 'Observation')}</label><input id={`adjust-${field}`} type="number" min="0" max="12" step="1" bind:value={adjust[field as 'evacuated' | 'waiting' | 'observation']} required /></div>{/each}</div><label for="adjust-isolation">{t('隔离状态', 'Isolation')}</label><select id="adjust-isolation" bind:value={adjust.isolation}>{#each Object.entries(isolationLabels) as [value, label]}<option {value}>{label[$locale]}</option>{/each}</select><label for="adjust-clinic">{t('医疗交接', 'Clinical handover')}</label><select id="adjust-clinic" bind:value={adjust.clinic}>{#each Object.entries(clinicLabels) as [value, label]}<option {value}>{label[$locale]}</option>{/each}</select><label for="override-reason">{t('公开调整原因', 'Public reason for the adjustment')}</label><textarea id="override-reason" bind:value={reason} maxlength="1000" required></textarea><button class="btn secondary" disabled={locked}>{t('记录实际结果', 'Record fictional outcomes')}</button></form></details>{/if}
