<script lang="ts">
  import { onDestroy } from 'svelte';
  import Icon from './Icon.svelte';
  import { faArrowLeft, faArrowRight, faArrowUpFromBracket, faCheck, faClock, faDiceD20, faLink, faShieldHalved, faTowerBroadcast, faUsers, faWater } from '@fortawesome/free-solid-svg-icons';
  import { locale } from '../lib/i18n';
  import { enter, busy, resume, savedSessions } from '../lib/client';
  import { createHomeDrafts, type ArchiveFailure } from '../lib/home-drafts';
  import type { Settings } from '../../shared/types';
  import { maxArchiveBytes } from '../../shared/archive';
  import Seascape from './Seascape.svelte';
  let { joinCode = '' }: { joinCode?: string } = $props();
  const drafts = createHomeDrafts();
  let tab = $derived($drafts.tab), step = $derived($drafts.step), archive = $derived($drafts.archive);
  let name = $state(''), code = $state(''), gmCount = $state(2);
  let mode = $state<'full' | 'short'>('full'), dice = $state<'virtual' | 'physical'>('virtual');
  onDestroy(drafts.cancelArchive);
  const t = (zh: string, en: string) => $locale === 'zh-CN' ? zh : en;
  $effect(() => { if (joinCode) code = joinCode; });
  const recent = savedSessions().slice(-3).reverse();
  const archiveError = (reason: ArchiveFailure) => reason === 'too-large'
    ? t(`存档不能超过 ${maxArchiveBytes / 1024 / 1024} MiB。`, `Saves must not exceed ${maxArchiveBytes / 1024 / 1024} MiB.`)
    : reason === 'invalid-root'
      ? t('存档根值必须是 JSON 对象，请重新选择。', 'The save must contain a JSON object. Choose another file.')
      : t('无法读取这个 JSON 存档，请重新选择。', 'Could not read this JSON save. Choose another file.');
  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if ($busy) return;
    const submission = drafts.prepareSubmission();
    if (!submission) return;
    await enter(submission.kind, name, submission.kind === 'import' ? submission.save : submission.kind === 'create' ? { mode, gmCount, dice } satisfies Settings : code);
  }
  function loadArchive(event: Event) {
    if ($busy) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // Allow retrying the same file after a failed read.
    void drafts.loadArchive(file);
  }
</script>

<main id="main" class="m-auto grid w-full max-w-[1480px] grid-cols-[minmax(0,1.25fr)_minmax(350px,.8fr)] items-center gap-[clamp(36px,6vw,110px)] px-[clamp(24px,5.5vw,96px)] pt-[54px] pb-[50px] max-xl:gap-10 max-xl:px-[45px] max-lg:grid-cols-[minmax(0,1fr)_minmax(330px,.9fr)] max-lg:gap-[30px] max-lg:px-7 max-lg:py-10 max-md:mx-auto max-md:my-0 max-md:max-w-[580px] max-md:grid-cols-1 max-md:px-[22px] max-md:pt-[31px] max-md:pb-8 max-[360px]:px-[18px]">
  <section class="min-w-0">
    <div class="mb-6 flex items-center gap-3 text-[11px] tracking-[.04em] text-[#afc7c2] max-md:mb-5 max-md:text-[10px]"><span class="signal-dot"></span>Heliora Prime <span class="opacity-40">/</span> Luminis Sea</div>
    <h1 class={['font-story font-normal leading-[1.2]', $locale === 'en' ? 'text-[clamp(48px,5.2vw,80px)] tracking-[-.04em]' : 'text-[clamp(52px,5.4vw,84px)] tracking-[.02em] max-xl:text-[64px] max-lg:text-[53px] max-md:text-[58px] max-[360px]:text-[50px]']}>
      {t('绿灯之下', 'Under the')}<span class={['block font-display font-normal tracking-normal text-[#c9dbce]', $locale === 'en' ? 'mt-0 [font-size:inherit] leading-[1.05]' : 'mt-3 text-[clamp(20px,2.2vw,32px)] max-md:text-[23px]']}>{t('Under the Green Light', 'Green Light')}</span>
    </h1>
    <p class="mt-6 max-w-[460px] text-[14px] leading-[1.9] text-[#c0d2cd] max-lg:text-[12px] max-md:mt-[21px]">{t('一盏绿灯，十二个人。', 'One green light. Twelve lives.')}<br />{t('当安全的信号不再可信，你们会如何行动？', 'When a safe signal can’t be trusted, what will you do?')}</p>
    <a class="mt-[22px] hidden items-center gap-2.5 rounded-md border border-[#a5c2b3] px-[15px] py-3 text-[12px] text-[#e2ebde] max-md:inline-flex" href="#room-entry">{t('加入 / 创建房间', 'Join / create a room')}<Icon icon={faArrowRight} size={17} /></a>
    <div class="relative mt-6 overflow-hidden rounded-lg border border-[#ffffff0c] [&>svg]:-mt-[12%] [&>svg]:-mb-[4%] max-lg:[&>svg]:my-0 max-md:mt-[23px] max-md:[&>svg]:-mt-[14%] max-md:[&>svg]:-mb-[5%]">
      <Seascape />
      <div class="absolute inset-x-0 bottom-0 flex items-center justify-between bg-[linear-gradient(0deg,#123542ed,#12354200)] px-[18px] pt-[22px] pb-3.5 text-[10px] text-[#c4d7cf]"><span class="flex items-center gap-[7px]"><Icon icon={faTowerBroadcast} size={14} /> {t('外围泵站 · 状态回传中断', 'Coastal pump station · Status link lost')}</span><span>17:40</span></div>
    </div>
    <div class="mt-[25px] flex justify-between gap-3 px-1 [&>div]:flex [&>div]:items-center [&>div]:gap-[9px] [&>div]:text-[11px] [&>div]:text-[#bdd0c8] [&_svg]:text-[#a5c4b4] max-xl:gap-2.5 max-xl:[&>div]:gap-[7px] max-xl:[&>div]:text-[10px] max-lg:flex-wrap max-lg:justify-start max-lg:gap-[17px] max-lg:[&>div]:text-[9px] max-md:mt-5 max-md:justify-between max-md:[&>div]:gap-1.5 max-md:[&>div]:text-[10px] max-md:[&_svg]:w-[17px] max-[360px]:[&>div]:text-[9px]">
      <div><Icon icon={faLink} size={20} /><span>{t('建立通路', 'Open a route')}</span></div><div><Icon icon={faUsers} size={20} /><span>{t('转移人员', 'Move the people')}</span></div><div><Icon icon={faShieldHalved} size={20} /><span>{t('隔离危险', 'Isolate the hazard')}</span></div>
    </div>
  </section>
  <section id="room-entry" class={['min-w-0 rounded-2xl bg-entry px-8 pt-[34px] pb-[25px] text-ink shadow-[0_20px_50px_#06212b30] max-xl:px-[25px] max-xl:py-[29px] max-md:scroll-mt-5 max-md:rounded-[13px] max-md:pt-7 max-md:pb-[23px] max-[360px]:px-5', joinCode && 'max-md:-order-1']} aria-label={t('加入或创建房间', 'Join or create a room')}>
    <div><span class="tiny-tag text-[10px]">{t('Guardians 协作剧场', 'A Guardians cooperative story')}</span><h2 class="mt-3 text-[23px] leading-[1.4] max-md:text-[24px]">{t('救援，从集结开始。', 'Every rescue starts together.')}</h2><p class="mt-2 text-[12px] leading-[1.6] text-muted">{t('邀请同伴，准备好你们的下一个决定。', 'Gather your team. Make the next decision together.')}</p></div>
    <div class="mt-[27px] flex gap-[26px] border-b border-line [&>button]:relative [&>button]:min-h-[45px] [&>button]:flex-1 [&>button]:border-0 [&>button]:bg-transparent [&>button]:py-3 [&>button]:text-[14px] [&>button]:font-[550] [&>button]:text-muted [&>button[aria-selected=true]]:-mb-px [&>button[aria-selected=true]]:border-b-2 [&>button[aria-selected=true]]:border-ocean [&>button[aria-selected=true]]:text-ink" role="tablist" aria-label={t('房间选项', 'Room options')}>
      <button role="tab" aria-selected={tab === 'join'} disabled={$busy} onclick={() => drafts.selectTab('join')}>{t('加入房间', 'Join a room')}</button>
      <button role="tab" aria-selected={tab === 'create'} disabled={$busy} onclick={() => drafts.selectTab('create')}>{t('创建房间', 'Create a room')}</button>
    </div>
    <form onsubmit={submit} class="pt-[22px] [&>label:first-child]:mt-0 [&>.primary]:mt-6 [&>.primary]:min-h-12">
      {#if tab === 'join'}
        <label for="room-code">{t('四位房间码', 'Four-digit room code')}</label>
        <input id="room-code" class="min-h-[70px] py-[13px] pr-2.5 pl-6 text-center text-[31px] font-medium tracking-[.5em] max-md:text-[32px]" bind:value={code} inputmode="numeric" pattern={'[0-9]{4}'} maxlength="4" placeholder="0 0 0 0" required autocomplete="off" />
        <p class="field-hint">{t('向主持人获取房间码，或扫描邀请二维码。', 'Get a code from your GM, or scan the invitation QR.')}</p>
        <label for="join-name">{t('你的名字', 'Your name')}</label><input id="join-name" class="max-md:text-[16px]" bind:value={name} required maxlength="32" autocomplete="nickname" placeholder={t('同伴们该怎么称呼你？', 'What should your teammates call you?')} />
        <button class="btn primary w-full" disabled={$busy} type="submit">{t('加入救援', 'Join the rescue')}<Icon icon={faArrowRight} size={18} /></button>
      {:else}
        <div class="mb-[21px] flex items-center gap-1.5" aria-label={t(`创建步骤 ${step}/3`, `Setup step ${step} of 3`)}>{#each [1, 2, 3] as n}<span class={['flex size-[21px] items-center justify-center rounded-full border text-[10px]', step >= n ? 'border-ocean bg-ocean text-on-accent' : 'border-line text-muted']}>{#if step > n}<Icon icon={faCheck} size={13} />{:else}{n}{/if}</span>{#if n < 3}<i class="h-px w-4 bg-line"></i>{/if}{/each}<small class="ml-auto text-[10px] text-muted">{t(['', '选择剧本', '设置房间', '准备出发'][step], ['', 'Choose a story', 'Set up the room', 'Ready to go'][step])}</small></div>
        {#if step === 1}
          <div class="flex items-center gap-3 rounded-[9px] border border-border-hover bg-selected px-3.5 py-[18px]"><Icon icon={faWater} size={27} /><div class="flex-1"><strong class="block text-[15px]">{t('绿灯之下', 'Under the Green Light')}</strong><span class="mt-[5px] block text-[10px] text-muted">Guardians Guild · {t('合作救援', 'Cooperative rescue')}</span></div><Icon icon={faCheck} size={18} /></div>
          <div class="mt-[17px] grid grid-cols-2 gap-2.5">
            <button type="button" class="choice" aria-pressed={mode === 'full'} onclick={() => mode = 'full'}><strong>{t('完整剧本', 'Full story')}</strong><span><Icon icon={faClock} size={14} />45 + 10 {t('分钟', 'min')}</span><small>{t('调查检定、协商与完整救援', 'Preparation checks, coordination and rescue')}</small></button>
            <button type="button" class="choice" aria-pressed={mode === 'short'} onclick={() => mode = 'short'}><strong>{t('精简剧本', 'Short story')}</strong><span><Icon icon={faClock} size={14} />20 + 5 {t('分钟', 'min')}</span><small>{t('共享线索，跳过准备骰，两人搭档执行', 'Shared evidence, no preparation rolls, paired leads')}</small></button>
          </div>
          <p class="field-hint">{t('时间包含游戏与复盘。建议 4–8 名玩家。', 'Times include play and debrief. Recommended for 4–8 players.')}</p>
        {:else if step === 2}
          <label for="gm-count">{t('主持人数', 'Number of GMs')}</label><select id="gm-count" class="max-md:text-[16px]" bind:value={gmCount}><option value={1}>1 GM</option><option value={2}>2 Co-GMs</option><option value={3}>3 GMs</option><option value={4}>4 GMs</option></select>
          <p class="field-hint">{t('房主占一个席位，其他主持人加入后由房主分配身份。', 'The owner takes one seat and assigns the other GMs after they join.')}</p>
          <p class="mt-[17px] mb-2 text-[12px] font-semibold text-label">{t('骰子方式', 'Dice mode')}</p><div class="mt-[17px] grid grid-cols-2 gap-2.5"><button type="button" class="choice" aria-pressed={dice === 'virtual'} onclick={() => dice = 'virtual'}><Icon icon={faDiceD20} size={22} /><strong>{t('虚拟 D20', 'Virtual D20')}</strong><small>{t('系统公平掷骰，实时动画', 'Server rolls with a shared animation')}</small></button><button type="button" class="choice" aria-pressed={dice === 'physical'} onclick={() => dice = 'physical'}><Icon icon={faDiceD20} size={22} /><strong>{t('实体 D20', 'Physical D20')}</strong><small>{t('一人掷骰，每次由 GM 录入', 'One player rolls; a GM enters each result')}</small></button></div>
        {:else}
          {#if archive.status !== 'unselected'}<div class="inline-info" role="status"><Icon icon={faArrowUpFromBracket} size={18} /><div class="min-w-0 wrap-anywhere"><span class="block">{archive.name}</span><small class="block text-[11px]">{archive.status === 'loading' ? t('正在读取存档，请稍候…', 'Reading save. Please wait…') : archive.status === 'failed' ? archiveError(archive.reason) : t('已选择存档，将恢复到新房间。', 'Save selected. It will be restored into a new room.')}</small></div></div>{:else}<div class="mb-5 flex flex-wrap gap-2 [&>span]:rounded [&>span]:bg-badge [&>span]:px-[9px] [&>span]:py-1.5 [&>span]:text-[11px] [&>span]:text-muted"><span>{t(mode === 'full' ? '完整剧本' : '精简剧本', mode === 'full' ? 'Full story' : 'Short story')}</span><span>{gmCount} {gmCount === 2 ? 'Co-GMs' : 'GM'}</span><span>{t(dice === 'virtual' ? '虚拟骰' : '实体骰', dice === 'virtual' ? 'Virtual dice' : 'Physical dice')}</span></div>{/if}
          <label for="host-name">{t('主持人名字', 'Your GM name')}</label><input id="host-name" class="max-md:text-[16px]" bind:value={name} required maxlength="32" autocomplete="nickname" placeholder={t('大家该怎么称呼你？', 'What should the team call you?')} />
          <div class="mt-[21px] flex items-start gap-2.5 rounded-[7px] bg-soft p-[13px]"><Icon icon={faShieldHalved} size={18} class="mt-0.5 text-muted" /><p class="text-[11px] text-muted">{t('D20 + 一项相关加成。准备与创意降难度取较高者，最多 2。两份共享应急物资，每次最多提升一档。', 'D20 + one relevant bonus. Use the greater preparation or creative reduction, up to 2. Two shared emergency kits; each check may improve once, by one tier.')}</p></div>
        {/if}
        <div class="form-buttons">{#if step > 1}<button class="btn ghost" type="button" disabled={$busy} onclick={drafts.previous} aria-label={t('上一步', 'Previous step')}><Icon icon={faArrowLeft} size={18} /></button>{/if}<button class="btn primary" disabled={$busy || archive.status === 'loading' || archive.status === 'failed'} type="submit">{step < 3 ? t('继续', 'Continue') : archive.status !== 'unselected' ? t('从存档创建', 'Restore into a new room') : t('创建救援房间', 'Create rescue room')}<Icon icon={faArrowRight} size={18} /></button></div>
      {/if}
    </form>
    {#if recent.length}<div class="mt-[23px] flex flex-wrap gap-[7px] border-t border-line pt-4"><span class="mb-1 block w-full text-[10px] text-muted">{t('回到之前的房间', 'Return to a room')}</span>{#each recent as s}<button class="flex items-center gap-2.5 rounded-[5px] border border-line bg-surface px-[9px] py-[7px] text-[12px] text-ink" onclick={() => { drafts.cancelArchive(); history.pushState({}, '', `/room/${s.code}`); resume(s.code); }}>{s.code}<small class="max-w-20 overflow-hidden text-[10px] text-ellipsis text-muted">{s.name}</small><Icon icon={faArrowRight} size={14} /></button>{/each}</div>{/if}
    <label class="mt-[21px] flex min-h-7 cursor-pointer items-center justify-center gap-[7px] text-[10px] font-normal text-muted"><Icon icon={faArrowUpFromBracket} size={14} />{t('恢复 JSON 存档', 'Restore a JSON save')}<input type="file" disabled={$busy} accept="application/json,.json" onchange={loadArchive} class="sr-only" /></label>
    {#if archive.status === 'unselected'}<p class="mt-1 text-center text-[10px] text-muted">{t('未选择存档', 'No save selected')}</p>{/if}
    <p class="mt-[11px] text-center text-[9px] tracking-[.02em] text-muted">{t('无需注册 · 进度自动保存 · 中英文同步体验', 'No account needed · Autosaved progress · English & 中文')}</p>
  </section>
</main>
