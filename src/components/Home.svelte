<script lang="ts">
  import { ArrowRight, ArrowLeft, Users, Dices, Radio, ShieldCheck, Upload, Clock, Waves, Link, Check } from 'lucide-svelte';
  import { locale } from '../lib/i18n';
  import { enter, busy, resume, savedSessions, notice } from '../lib/client';
  import type { Settings } from '../../shared/types';
  import Seascape from './Seascape.svelte';
  let { joinCode = '' }: { joinCode?: string } = $props();
  let tab = $state<'join' | 'create'>('join');
  let step = $state(1), name = $state(''), code = $state(''), gmCount = $state(2);
  let mode = $state<'full' | 'short'>('full'), dice = $state<'virtual' | 'physical'>('virtual');
  let archive = $state<unknown>(null), archiveName = $state('');
  const t = (zh: string, en: string) => $locale === 'zh-CN' ? zh : en;
  $effect(() => { if (joinCode) code = joinCode; });
  const recent = savedSessions().slice(-3).reverse();
  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (tab === 'create' && !archive && step < 3) { step++; return; }
    await enter(archive ? 'import' : tab === 'create' ? 'create' : 'join', name, archive ?? (tab === 'create' ? { mode, gmCount, dice } satisfies Settings : code));
  }
  async function loadArchive(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return;
    if (file.size > 1_048_576) { notice.set({ 'zh-CN': '存档不能超过 1 MB。', en: 'Saves must be smaller than 1 MB.' }); return; }
    try { archive = JSON.parse(await file.text()); archiveName = file.name; tab = 'create'; step = 3; }
    catch { notice.set({ 'zh-CN': '无法读取这个 JSON 存档。', en: 'Could not read this JSON save.' }); }
  }
</script>

<main id="main" class="home" class:invite-entry={Boolean(joinCode)}>
  <section class="home-story">
    <div class="story-location"><span class="signal-dot"></span>Heliora Prime <span class="location-divider">/</span> Luminis Sea</div>
    <h1>{t('绿灯之下', 'Under the')}<span>{t('Under the Green Light', 'Green Light')}</span></h1>
    <p class="home-hook">{t('一盏绿灯，十二个人。', 'One green light. Twelve lives.')}<br />{t('当安全的信号不再可信，你们会如何行动？', 'When a safe signal can’t be trusted, what will you do?')}</p>
    <a class="mobile-entry-link" href="#room-entry">{t('加入 / 创建房间', 'Join / create a room')}<ArrowRight size={17} /></a>
    <div class="home-art"><Seascape /><div class="art-caption"><span><Radio size={14} /> {t('外围泵站 · 状态回传中断', 'Coastal pump station · Status link lost')}</span><span>17:40</span></div></div>
    <div class="home-objectives">
      <div><Link size={20} /><span>{t('建立通路', 'Open a route')}</span></div><div><Users size={20} /><span>{t('转移人员', 'Move the people')}</span></div><div><ShieldCheck size={20} /><span>{t('隔离危险', 'Isolate the hazard')}</span></div>
    </div>
  </section>
  <section id="room-entry" class="entry-panel" aria-label={t('加入或创建房间', 'Join or create a room')}>
    <div class="entry-intro"><span class="tiny-tag">{t('Guardians 协作剧场', 'A Guardians cooperative story')}</span><h2>{t('救援，从集结开始。', 'Every rescue starts together.')}</h2><p>{t('邀请同伴，准备好你们的下一个决定。', 'Gather your team. Make the next decision together.')}</p></div>
    <div class="entry-tabs" role="tablist" aria-label={t('房间选项', 'Room options')}>
      <button role="tab" aria-selected={tab === 'join'} onclick={() => { tab = 'join'; archive = null; }}>{t('加入房间', 'Join a room')}</button>
      <button role="tab" aria-selected={tab === 'create'} onclick={() => { tab = 'create'; archive = null; }}>{t('创建房间', 'Create a room')}</button>
    </div>
    <form onsubmit={submit} class="entry-form">
      {#if tab === 'join'}
        <label for="room-code">{t('四位房间码', 'Four-digit room code')}</label>
        <input id="room-code" class="code-input" bind:value={code} inputmode="numeric" pattern={'[0-9]{4}'} maxlength="4" placeholder="0 0 0 0" required autocomplete="off" />
        <p class="field-hint">{t('向主持人获取房间码，或扫描邀请二维码。', 'Get a code from your GM, or scan the invitation QR.')}</p>
        <label for="join-name">{t('你的名字', 'Your name')}</label><input id="join-name" bind:value={name} required maxlength="32" autocomplete="nickname" placeholder={t('同伴们该怎么称呼你？', 'What should your teammates call you?')} />
        <button class="btn primary wide" disabled={$busy} type="submit">{t('加入救援', 'Join the rescue')}<ArrowRight size={18} /></button>
      {:else}
        <div class="setup-progress" aria-label={t(`创建步骤 ${step}/3`, `Setup step ${step} of 3`)}>{#each [1, 2, 3] as n}<span class:current={step === n} class:done={step > n}>{#if step > n}<Check size={13} />{:else}{n}{/if}</span>{#if n < 3}<i></i>{/if}{/each}<small>{t(['', '选择剧本', '设置房间', '准备出发'][step], ['', 'Choose a story', 'Set up the room', 'Ready to go'][step])}</small></div>
        {#if step === 1}
          <div class="scenario-selected"><Waves size={27} /><div><strong>{t('绿灯之下', 'Under the Green Light')}</strong><span>Guardians Guild · {t('合作救援', 'Cooperative rescue')}</span></div><Check size={18} /></div>
          <div class="choice-grid">
            <button type="button" class="choice" class:chosen={mode === 'full'} aria-pressed={mode === 'full'} onclick={() => mode = 'full'}><strong>{t('完整剧本', 'Full story')}</strong><span><Clock size={14} />45 + 10 {t('分钟', 'min')}</span><small>{t('调查检定、协商与完整救援', 'Preparation checks, coordination and rescue')}</small></button>
            <button type="button" class="choice" class:chosen={mode === 'short'} aria-pressed={mode === 'short'} onclick={() => mode = 'short'}><strong>{t('精简剧本', 'Short story')}</strong><span><Clock size={14} />20 + 5 {t('分钟', 'min')}</span><small>{t('共享线索，跳过准备骰，两人搭档执行', 'Shared evidence, no preparation rolls, paired leads')}</small></button>
          </div>
          <p class="field-hint">{t('时间包含游戏与复盘。建议 4–8 名玩家。', 'Times include play and debrief. Recommended for 4–8 players.')}</p>
        {:else if step === 2}
          <label for="gm-count">{t('主持人数', 'Number of GMs')}</label><select id="gm-count" bind:value={gmCount}><option value={1}>1 GM</option><option value={2}>2 Co-GMs</option><option value={3}>3 GMs</option><option value={4}>4 GMs</option></select>
          <p class="field-hint">{t('房主占一个席位，其他主持人加入后由房主分配身份。', 'The owner takes one seat and assigns the other GMs after they join.')}</p>
          <p class="field-label">{t('骰子方式', 'Dice mode')}</p><div class="choice-grid"><button type="button" class="choice" class:chosen={dice === 'virtual'} aria-pressed={dice === 'virtual'} onclick={() => dice = 'virtual'}><Dices size={22} /><strong>{t('虚拟 D20', 'Virtual D20')}</strong><small>{t('系统公平掷骰，实时动画', 'Server rolls with a shared animation')}</small></button><button type="button" class="choice" class:chosen={dice === 'physical'} aria-pressed={dice === 'physical'} onclick={() => dice = 'physical'}><span class="physical-die">20</span><strong>{t('实体 D20', 'Physical D20')}</strong><small>{t('一人掷骰，每次由 GM 录入', 'One player rolls; a GM enters each result')}</small></button></div>
        {:else}
          {#if archive}<div class="inline-info"><Upload size={18} /><span class="min-w-0 [overflow-wrap:anywhere]">{archiveName}</span></div>{:else}<div class="setup-summary"><span>{t(mode === 'full' ? '完整剧本' : '精简剧本', mode === 'full' ? 'Full story' : 'Short story')}</span><span>{gmCount} {gmCount === 2 ? 'Co-GMs' : 'GM'}</span><span>{t(dice === 'virtual' ? '虚拟骰' : '实体骰', dice === 'virtual' ? 'Virtual dice' : 'Physical dice')}</span></div>{/if}
          <label for="host-name">{t('主持人名字', 'Your GM name')}</label><input id="host-name" bind:value={name} required maxlength="32" autocomplete="nickname" placeholder={t('大家该怎么称呼你？', 'What should the team call you?')} />
          <div class="rule-note"><ShieldCheck size={18} /><p>{t('D20 + 一项相关加成。准备与创意降难度取较高者，最多 2。两份共享应急物资，每次最多提升一档。', 'D20 + one relevant bonus. Use the greater preparation or creative reduction, up to 2. Two shared emergency kits; each check may improve once, by one tier.')}</p></div>
        {/if}
        <div class="form-buttons">{#if step > 1}<button class="btn ghost" type="button" onclick={() => { if (archive) { archive = null; archiveName = ''; } step--; }} aria-label={t('上一步', 'Previous step')}><ArrowLeft size={18} /></button>{/if}<button class="btn primary" disabled={$busy} type="submit">{step < 3 ? t('继续', 'Continue') : archive ? t('从存档创建', 'Restore into a new room') : t('创建救援房间', 'Create rescue room')}<ArrowRight size={18} /></button></div>
      {/if}
    </form>
    {#if recent.length}<div class="recent-sessions"><span>{t('回到之前的房间', 'Return to a room')}</span>{#each recent as s}<button onclick={() => { history.pushState({}, '', `/room/${s.code}`); resume(s.code); }}>{s.code}<small>{s.name}</small><ArrowRight size={14} /></button>{/each}</div>{/if}
    <label class="import-link"><Upload size={14} />{t('恢复 JSON 存档', 'Restore a JSON save')}<input type="file" accept="application/json,.json" onchange={loadArchive} class="sr-only" /></label>
    <p class="entry-footnote">{t('无需注册 · 进度自动保存 · 中英文同步体验', 'No account needed · Autosaved progress · English & 中文')}</p>
  </section>
</main>
