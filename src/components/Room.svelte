<script lang="ts">
  import Icon from './Icon.svelte';
  import { faBookOpen, faBoxOpen, faCheck, faChevronRight, faClockRotateLeft, faCodeBranch, faCopy, faDownload, faEye, faFolderOpen, faLanguage, faPause, faPenToSquare, faPlay, faPlugCircleXmark, faRightFromBracket, faShareNodes, faShieldHalved, faSpinner, faTowerBroadcast, faUsers, faWifi, faXmark } from '@fortawesome/free-solid-svg-icons';
  import { onMount, untrack } from 'svelte';
  import QRCode from 'qrcode';
  import type { RoomView } from '../../shared/types';
  import { phases } from '../../shared/types';
  import { phaseLabels, tracks, isolationLabels } from '../../shared/content';
  import { locale } from '../lib/i18n';
  import { command, busy, connection, leave, resume, downloadSave, copy } from '../lib/client';
  import Brand from './Brand.svelte';
  import Stage from './Stage.svelte';
  import Evidence from './Evidence.svelte';
  import Flow from './Flow.svelte';
  import People from './People.svelte';
  let { game }: { game: RoomView } = $props();
  let tab = $state('story'), presenting = $state(false), now = $state(Date.now());
  let shareDialog: HTMLDialogElement, notesDialog: HTMLDialogElement;
  let joinInput: HTMLInputElement;
  let joinUrl = $state(untrack(() => `${location.origin}/room/${game.code}`)), qr = $state(''), qrError = $state(false);
  let copyStatus = $state<'idle' | 'copying' | 'copied' | 'manual'>('idle');
  let notesDraft = $state(''), notesRevision = $state(0);
  const me = $derived(game.members.find(m => m.id === game.me)!);
  const gm = $derived(me.role === 'gm' && !presenting);
  const status = $derived(tracks(game));
  const currentPhase = $derived(game.phase);
  const locked = $derived($busy || $connection !== 'live');
  const elapsed = $derived(Math.floor((game.clock.elapsed + (game.clock.runningSince === null ? 0 : Math.max(0, now - game.clock.runningSince))) / 1000));
  const t = (zh: string, en: string) => $locale === 'zh-CN' ? zh : en;
  const tabs = [
    { id: 'story', icon: faBookOpen, zh: '任务现场', en: 'The mission' }, { id: 'evidence', icon: faFolderOpen, zh: '共享证据', en: 'Evidence' },
    { id: 'flow', icon: faCodeBranch, zh: '进度与分叉', en: 'The path' }, { id: 'people', icon: faUsers, zh: '救援成员', en: 'The team' }, { id: 'history', icon: faClockRotateLeft, zh: '行动记录', en: 'Activity' }
  ];
  $effect(() => {
    const url = joinUrl; qrError = false; let cancelled = false;
    if (/^https?:\/\//.test(url)) QRCode.toDataURL(url, { width: 240, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#173e48', light: '#ffffff' } }).then(value => { if (!cancelled) qr = value; }).catch(() => { if (!cancelled) qrError = true; });
    else { qr = ''; qrError = true; }
    return () => { cancelled = true; };
  });
  onMount(() => { const timer = setInterval(() => now = Date.now(), 1000); return () => clearInterval(timer); });
  $effect(() => { joinUrl; copyStatus = 'idle'; });
  $effect(() => { currentPhase; if (tab === 'story') window.scrollTo({ top: 0 }); });
  function navigate(nextTab: string) { tab = nextTab; window.scrollTo({ top: 0 }); }
  function share() { copyStatus = 'idle'; shareDialog.showModal(); }
  async function copyInvite() {
    if (copyStatus === 'copying') return;
    const value = joinUrl;
    copyStatus = 'copying';
    const copied = await copy(value);
    if (joinUrl !== value) return;
    copyStatus = copied ? 'copied' : 'manual';
    if (!copied) { joinInput.focus({ preventScroll: true }); joinInput.select(); joinInput.setSelectionRange(0, value.length); }
  }
</script>

<div>
  <header class="sticky top-0 z-30 flex h-[72px] items-center gap-8 bg-header px-[26px] text-[#edf3ec] max-xl:gap-[22px] max-xl:px-[22px] max-lg:justify-between max-md:h-[61px] max-md:gap-3 max-md:px-[15px] max-[360px]:gap-2 max-[360px]:px-[11px]">
    <Brand small />
    <div class="flex flex-1 items-center gap-2.5 text-[11px] text-[#9db8b1] max-xl:text-[10px] max-lg:hidden"><span>{t('绿灯之下', 'Under the Green Light')}</span><Icon icon={faChevronRight} size={13} /><strong class="font-medium text-[#d5e4d9]">{phaseLabels[game.phase][$locale]}</strong></div>
    <div class="flex items-center gap-3.5 max-xl:gap-2.5 max-md:gap-[7px] max-[360px]:gap-[5px]">
      <span class={['flex items-center gap-1.5 text-[10px] whitespace-nowrap max-md:mr-px max-[360px]:hidden', $connection === 'live' ? 'text-[#b9d8bf]' : 'text-[#ebc29f]']}>
        {#if $connection === 'live'}<Icon icon={faWifi} size={14} />{:else if $connection === 'connecting'}<Icon icon={faSpinner} size={14} spin />{:else}<Icon icon={faPlugCircleXmark} size={14} />{/if}
        <span class="max-md:hidden">{$connection === 'live' ? t('实时同步', 'Live sync') : $connection === 'connecting' ? t('连接中', 'Connecting') : $connection === 'expired' ? t('身份已失效', 'Session expired') : t('正在重连', 'Reconnecting')}</span>
      </span>
      <button class="flex min-h-9 items-center gap-[11px] rounded-[5px] border border-[#ffffff24] bg-[#ffffff08] px-3 py-2 text-[14px] tracking-[.17em] text-[#e6eee3] max-md:min-h-[34px] max-md:gap-[5px] max-md:px-[9px] max-md:py-[7px] max-md:text-[12px] max-md:tracking-[.1em]" onclick={() => copy(game.code)} aria-label={t('复制房间码', 'Copy room code')}>{game.code}<Icon icon={faCopy} size={13} class="max-md:w-[11px]" /></button>
      <button class="btn min-h-9 rounded-[5px] bg-[#d4e5d6] px-3 py-2 text-[11px] text-[#1c4a45] max-md:min-h-[34px] max-md:px-2 max-md:py-[7px]" onclick={share}><Icon icon={faShareNodes} size={16} /><span class="max-md:hidden">{t('邀请', 'Invite')}</span></button>
      <button class="flex min-h-[38px] min-w-16 items-center justify-center gap-[7px] rounded-md border border-[#ffffff24] bg-[#ffffff07] p-2 text-[12px] text-inherit hover:bg-[#ffffff15] max-md:min-h-[34px] max-md:min-w-[43px] max-md:gap-[3px] max-md:p-1.5 max-md:text-[10px]" onclick={() => locale.set($locale === 'zh-CN' ? 'en' : 'zh-CN')}><Icon icon={faLanguage} size={16} class="max-md:w-[13px]" />{$locale === 'zh-CN' ? 'EN' : '中文'}</button>
    </div>
  </header>

  {#if $connection !== 'live'}
    <div class="sticky top-[72px] z-29 flex items-center gap-[13px] bg-warning-bg px-[26px] py-[13px] text-[12px] text-warning-text max-md:top-[61px] max-md:gap-[9px] max-md:px-[15px] max-md:py-[11px] max-md:text-[10px] max-md:leading-[1.7]" role="status"><Icon icon={faPlugCircleXmark} size={17} /><span class="flex-1">{$connection === 'expired' ? t('登录身份已失效。请返回首页重新加入。', 'Your session has expired. Return home and join again.') : t('连接中断时仍可查看已同步内容。连接恢复后自动更新，操作暂时暂停。', 'Synced content is still available. Actions pause until the connection recovers and game updates automatically.')}</span><button class="rounded-[5px] border border-warning-line bg-transparent p-2 whitespace-nowrap text-inherit max-md:p-1.5 max-md:text-[9px]" onclick={() => $connection === 'expired' ? leave() : resume(game.code)}>{$connection === 'expired' ? t('返回首页', 'Return home') : t('立即重连', 'Reconnect now')}</button></div>
  {/if}

  <div class="mx-auto grid max-w-[1920px] grid-cols-[222px_minmax(0,1fr)_246px] min-[1700px]:grid-cols-[250px_minmax(0,1fr)_275px] max-xl:grid-cols-[205px_minmax(0,1fr)] max-lg:grid-cols-[180px_minmax(0,1fr)] max-md:block">
    <aside class="sticky top-[72px] flex h-[calc(100svh-72px)] flex-col self-start overflow-y-auto border-r border-line bg-sidebar px-[18px] pt-7 min-[1700px]:px-[25px] max-lg:px-3 max-lg:pt-6 max-md:static max-md:contents max-md:h-auto max-md:p-0">
      <div class="px-3 pb-6 max-lg:px-2.5 max-md:hidden"><span class="tiny-tag text-[9px]">Guardians Guild</span><h2 class="mt-[9px] text-[19px] leading-[1.4] max-lg:text-[16px]">{t('绿灯之下', 'Under the Green Light')}</h2><span class="mt-2 flex items-center gap-[7px] text-[10px] text-muted">{game.settings.mode === 'full' ? t('完整剧本', 'Full story') : t('精简剧本', 'Short story')}<i class="size-[3px] rounded-full bg-offline-dot"></i>{game.settings.gmCount === 2 ? 'Co-GM' : `${game.settings.gmCount} GM`}</span></div>
      <nav class="flex flex-col gap-[5px] max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-40 max-md:flex-row max-md:justify-around max-md:gap-px max-md:border-t max-md:border-line max-md:bg-nav max-md:px-[5px] max-md:pt-1.5 max-md:pb-[max(7px,env(safe-area-inset-bottom))] max-md:backdrop-blur-[12px]" aria-label={t('房间导航', 'Room navigation')}>
        {#each tabs as item}
          <button class="flex min-h-[45px] items-center gap-3 rounded-[7px] border-0 bg-transparent px-[13px] py-[11px] text-left text-[12px] text-muted hover:bg-hover aria-[current=page]:bg-selected aria-[current=page]:font-semibold aria-[current=page]:text-green aria-[current=page]:hover:bg-hover [&[aria-current=page]>small]:text-green max-lg:gap-2.5 max-lg:px-[11px] max-lg:text-[11px] max-md:relative max-md:min-h-[54px] max-md:min-w-0 max-md:flex-1 max-md:flex-col max-md:justify-center max-md:gap-[5px] max-md:rounded-md max-md:px-2 max-md:py-[7px] max-md:text-center max-md:text-[9px] max-[360px]:px-[5px] max-[360px]:text-[8px]" aria-current={tab === item.id ? 'page' : undefined} onclick={() => navigate(item.id)}>
            <Icon icon={item.icon} size={19} class="max-md:w-[19px]" /><span>{t(item.zh, item.en)}</span>
            {#if item.id === 'evidence'}<small class="ml-auto rounded bg-badge px-[5px] py-px text-[9px] text-muted max-md:absolute max-md:top-0.5 max-md:right-2.5 max-md:text-[8px]">{game.evidence.length}</small>{:else if item.id === 'people'}<small class="ml-auto rounded bg-badge px-[5px] py-px text-[9px] text-muted max-md:absolute max-md:top-0.5 max-md:right-2.5 max-md:text-[8px]">{game.members.length}</small>{/if}
          </button>
        {/each}
      </nav>
      <div class="mx-3 mt-[29px] mb-5 border-t border-line pt-6 max-lg:mx-2.5 max-md:hidden"><span class="tiny-tag mb-3 block text-[9px]">{t('剧本进度', 'Story progress')}</span>{#each phases.filter(p => p !== 'lobby') as phase, i}<div class={['flex items-center gap-2.5 py-2 text-[10px]', game.phase === phase ? 'font-[650] text-green' : 'text-muted']}><span class={['w-[21px] text-[9px] text-muted', game.phase === phase && 'rounded-[3px] bg-badge py-0.5 text-center']}>{i + 1}</span>{phaseLabels[phase][$locale]}</div>{/each}</div>
      <div class="mt-auto pt-3 pb-[17px] max-md:hidden">
        {#if me.role === 'gm'}<button class="flex min-h-[38px] w-full items-center justify-center gap-2 rounded-md border border-line bg-raised p-2.5 text-[10px] text-muted" onclick={() => presenting = !presenting}>{#if presenting}<Icon icon={faShieldHalved} size={16} />{:else}<Icon icon={faEye} size={16} />{/if}{presenting ? t('返回主持视图', 'Return to GM view') : t('切换玩家展示', 'Show player view')}</button>{/if}
        <div class="flex items-center gap-[9px] px-0.5 pt-5 pb-0.5"><span class="avatar size-[31px] text-[14px]">{me.name.slice(0,1)}</span><div class="min-w-0 flex-1"><strong class="block overflow-hidden text-[11px] text-ellipsis">{me.name}</strong><span class="mt-1 block text-[9px] text-muted">{gm ? game.me === game.hostId ? t('房主 · 主持人', 'Owner · GM') : t('协作主持', 'Co-GM') : presenting ? t('玩家展示视图', 'Player presentation') : me.role === 'spectator' ? t('观察者', 'Observer') : t('救援成员', 'Team member')}</span></div><button class="flex border-0 bg-transparent p-[9px] text-muted" onclick={leave} aria-label={t('离开房间（保留进度）', 'Leave room (progress saved)')}><Icon icon={faRightFromBracket} size={17} /></button></div>
      </div>
    </aside>

    <main id="main" class="mx-auto w-full min-w-0 max-w-[1300px] px-[clamp(22px,3vw,52px)] pt-[37px] pb-5 min-[1700px]:pt-[50px] max-xl:px-[30px] max-xl:py-7 max-lg:px-[23px] max-md:max-w-[700px] max-md:px-5 max-md:pt-[22px] max-md:pb-[90px] max-[360px]:px-4">
      <div class="sr-only" role="status">{t('当前阶段：', 'Current stage: ')}{phaseLabels[game.phase][$locale]}</div>
      <div class="hidden max-xl:mb-[25px] max-xl:flex max-xl:justify-between max-xl:gap-3.5 max-xl:border-b max-xl:border-line max-xl:pb-[18px] max-xl:text-[10px] max-xl:text-muted [&>span]:flex [&>span]:items-center [&>span]:gap-1.5 max-md:mb-[23px] max-md:gap-[7px] max-md:pb-[17px] max-md:text-[9px] max-md:[&>span]:gap-[5px]"><span><Icon icon={faUsers} size={14} />{status.evacuated}/12 {t('已撤离', 'evacuated')}</span><span><Icon icon={faBoxOpen} size={14} />{game.emergencyKits} {t('份物资', 'kits')}</span><span>{game.settings.dice === 'virtual' ? t('虚拟 D20', 'Virtual D20') : t('实体 D20', 'Physical D20')}</span></div>
      <details class="hidden max-xl:-mt-2 max-xl:mb-[25px] max-xl:block max-xl:text-[11px] max-xl:text-muted"><summary class="min-h-8 cursor-pointer leading-8">{me.name} · {t('房间工具', 'Room tools')}</summary><div class="mt-2.5 flex flex-wrap items-center gap-2 [&_.btn]:max-md:text-[12px]">{#if me.role === 'gm'}<button class="btn secondary" onclick={() => presenting = !presenting}><Icon icon={faEye} size={15} />{presenting ? t('返回主持视图', 'Return to GM view') : t('玩家展示', 'Player view')}</button>{/if}{#if gm}<button class="btn secondary" onclick={() => { notesDraft = game.gmNotes ?? ''; notesRevision = game.revision; notesDialog.showModal(); }}><Icon icon={faPenToSquare} size={15} />{t('私密笔记', 'Private notes')}</button><button class="btn secondary" onclick={downloadSave}><Icon icon={faDownload} size={15} />{t('完整存档', 'Full save')}</button><button class="btn secondary" disabled={locked} onclick={() => command('clock')}>{game.clock.runningSince ? t('暂停计时', 'Pause timer') : t('继续计时', 'Resume timer')}</button>{/if}<button class="btn secondary" onclick={leave}><Icon icon={faRightFromBracket} size={15} />{t('返回首页', 'Return home')}</button></div></details>
      {#if tab === 'story'}{#key game.phase}<Stage {game} {gm} onshare={share} />{/key}
      {:else if tab === 'evidence'}<Evidence {game} />
      {:else if tab === 'flow'}<Flow {game} />
      {:else if tab === 'people'}<People {game} {gm} />
      {:else}<div class="section-title"><div><h1>{t('每一步都有记录', 'A record of every step')}</h1><p>{t('决定、更正与实际后果，按时间保留。', 'Decisions, corrections and fictional outcomes stay in chronological order.')}</p></div>{#if gm}<button class="btn secondary" onclick={downloadSave}><Icon icon={faDownload} size={16} />{t('完整存档', 'Full save')}</button>{/if}</div><ol class="m-0 list-none py-[5px]">
        {#each [...game.logs].reverse() as entry}<li class="relative flex gap-5 pb-7 before:absolute before:top-3 before:bottom-0 before:left-[5px] before:w-px before:bg-line before:content-[''] last:before:hidden max-md:gap-[15px]"><span class="relative z-1 mt-[7px] size-[11px] shrink-0 rounded-full border-2 border-border-hover bg-badge"></span><div><p class="text-[12px] leading-[1.85] wrap-anywhere text-muted">{entry.text[$locale]}</p><small class="mt-2 flex gap-[9px] text-[9px] text-muted max-md:text-[10px]">{game.members.find(m => m.id === entry.actorId)?.name ?? t('系统', 'System')}<span>·</span><time datetime={new Date(entry.at).toISOString()}>{new Date(entry.at).toLocaleTimeString($locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time></small></div></li>{/each}
      </ol>{/if}
      <footer class="mt-10 flex justify-between gap-5 border-t border-line pt-5 text-[9px] text-muted max-md:mt-[35px] max-md:flex-col max-md:gap-2 max-md:text-[8px]"><span>Heliora Prime · The Shell</span><span class="max-md:hidden">{t('保护生命，忠诚协作，如实沟通。', 'Protect life. Work together. Speak truthfully.')}</span></footer>
    </main>

    <aside class="sticky top-[72px] max-h-[calc(100svh-72px)] self-start overflow-y-auto border-l border-line bg-aside px-[23px] py-[30px] min-[1700px]:p-[35px] max-xl:hidden" aria-label={t('任务状态', 'Mission status')}>
      <div class="flex items-center gap-2 border-b border-line pb-[17px] text-[10px] text-muted"><Icon icon={faTowerBroadcast} size={17} /><span>{t('现场概况', 'Field status')}</span><span class="signal-dot ml-auto size-[5px]"></span></div>
      <div class="border-b border-line py-[22px]"><span class="text-[11px] text-muted">{t('维修人员', 'Maintenance workers')}</span><strong class="mt-[15px] block text-[51px] leading-[1.1] font-medium tracking-[-.06em]">{status.evacuated}<small class="ml-1.5 text-[17px] font-normal tracking-normal text-muted">/ 12</small></strong><p class="mt-[5px] text-[10px] text-muted">{t('已安全撤离', 'Safely evacuated')}</p><div class="mt-5 mb-3 flex flex-wrap gap-[5px]">{#each Array(12) as _, i}<span class={['h-3.5 w-2.5 rounded-[6px_6px_3px_3px] border', i < status.evacuated ? 'border-online-dot bg-online-dot' : 'border-line bg-soft']}></span>{/each}</div><small class="block text-[9px] leading-[1.8] text-muted">{game.checks.some(c => c.kind === 'execution' && c.objective === 'evacuation' && c.result) ? t(`${status.waiting} 人待援 · ${status.observation} 人需观察`, `${status.waiting} awaiting rescue · ${status.observation} need observation`) : t('12 人待转移，其中 2 人需要协助', '12 to move; 2 need assistance')}</small></div>
      <div class="border-b border-line py-[23px]"><span class="flex items-center gap-2 text-[11px] text-muted"><Icon icon={faBoxOpen} size={17} />{t('应急物资', 'Emergency kits')}</span><div class="mt-[15px] flex items-center gap-[9px]">{#each [0, 1] as i}<span class={['flex size-[39px] items-center justify-center rounded-[7px] border border-line text-muted', i >= game.emergencyKits ? 'border-dashed bg-transparent' : 'bg-badge']}><Icon icon={faBoxOpen} size={20} /></span>{/each}<strong class="ml-auto text-[12px] font-medium text-muted">{game.emergencyKits} / 2</strong></div><p class="mt-3 text-[9px] text-muted">{t('共享补救机会，每次提升一档。', 'Shared help. Improve one tier per check.')}</p></div>
      <div class="border-b border-line py-5"><span class="flex items-center gap-2 text-[11px] text-muted"><Icon icon={faShieldHalved} size={16} />{t('设施隔离', 'Facility isolation')}</span><strong class="mt-[11px] block text-[12px] font-medium text-muted">{isolationLabels[status.isolation][$locale]}</strong></div>
      <div class="pt-[18px] pb-[22px]"><div class="flex items-center justify-between text-[10px] text-muted"><span>{t('课堂用时', 'Session time')}</span>{#if gm}<button class="flex border-0 bg-transparent p-2 text-muted" disabled={locked} onclick={() => command('clock')} aria-label={game.clock.runningSince ? t('暂停课堂计时', 'Pause session timer') : t('继续课堂计时', 'Resume session timer')}>{#if game.clock.runningSince}<Icon icon={faPause} size={15} />{:else}<Icon icon={faPlay} size={15} />{/if}</button>{/if}</div><strong class="mt-0.5 block text-[27px] font-normal tracking-[.04em] tabular-nums">{String(Math.floor(elapsed / 60)).padStart(2,'0')}<span class="opacity-50">:</span>{String(elapsed % 60).padStart(2,'0')}</strong><p class="mt-3 text-[9px] text-muted">{t('独立于故事中的十二分钟。', 'Separate from the fictional twelve minutes.')}</p></div>
      <div class="flex items-start gap-2 pt-3 pb-5 text-muted"><Icon icon={faShieldHalved} size={18} /><p class="text-[9px] leading-[1.7]">{t('避难室保障约两小时。诊所独立备用供电 20 分钟。', 'Refuge: roughly two hours of protection. Clinic: 20-minute independent backup.')}</p></div>
      {#if gm}<button class="flex min-h-[38px] w-full items-center gap-[9px] border-0 bg-transparent py-2 text-left text-[10px] text-muted hover:text-green" onclick={() => { notesDraft = game.gmNotes ?? ''; notesRevision = game.revision; notesDialog.showModal(); }}><Icon icon={faPenToSquare} size={16} />{t('主持人私密笔记', 'Private GM notes')}</button><button class="flex min-h-[38px] w-full items-center gap-[9px] border-0 bg-transparent py-2 text-left text-[10px] text-muted hover:text-green" onclick={downloadSave}><Icon icon={faDownload} size={16} />{t('导出完整存档', 'Export full save')}</button>{/if}
    </aside>
  </div>
</div>

<dialog bind:this={shareDialog} class="max-md:px-5 max-md:py-6">
  <div class="flex items-center justify-between gap-[15px]"><h2 class="text-[22px] max-md:text-[21px]">{t('邀请同伴加入', 'Invite your teammates')}</h2><button class="-my-1.5 -mr-1.5 ml-0 flex border-0 bg-transparent p-2.5 text-muted" onclick={() => shareDialog.close()} aria-label={t('关闭邀请', 'Close invitation')}><Icon icon={faXmark} size={21} /></button></div>
  <p class="mt-[13px] text-[12px] text-muted">{t('扫描二维码，或输入四位房间码。', 'Scan the QR code or enter the four-digit code.')}</p>
  <div class="mx-auto mt-[25px] flex size-60 items-center justify-center overflow-hidden rounded-[9px] border border-evidence-line bg-white">{#if qr && !qrError}<img src={qr} width="240" height="240" alt={t('加入房间的二维码', 'QR code to join the room')} />{:else}<p class="p-5 text-[12px] text-[#526b59]">{t('请填写有效的 http / https 加入地址。', 'Enter a valid http / https invitation address.')}</p>{/if}</div>
  <div class="mt-3.5 pl-[.4em] text-center text-[37px] tracking-[.4em] text-muted">{game.code}</div>
  <label for="join-url">{t('加入链接', 'Invitation link')}</label>
  <div class="flex gap-2"><input class="text-[11px] max-md:text-[12px]" id="join-url" bind:this={joinInput} bind:value={joinUrl} type="url" /><button class="btn secondary" onclick={copyInvite} disabled={copyStatus === 'copying'} aria-label={t('复制加入链接', 'Copy invitation link')}>{#if copyStatus === 'copied'}<Icon icon={faCheck} size={18} />{:else}<Icon icon={faCopy} size={18} />{/if}</button></div>
  {#if /localhost|127\.0\.0\.1/.test(joinUrl)}<p class="field-hint mt-[13px] text-[12px]">{t('手机加入时，请将 localhost 改为电脑的局域网 IP；两台设备需在同一网络，或使用部署后的地址。', 'For a phone, replace localhost with your computer’s LAN IP on the same network, or use your deployed address.')}</p>{/if}
  <button class="btn primary mt-5 w-full" onclick={copyInvite} disabled={copyStatus === 'copying'} aria-busy={copyStatus === 'copying'}>{#if copyStatus === 'copied'}<Icon icon={faCheck} size={17} />{:else}<Icon icon={faShareNodes} size={17} />{/if}{copyStatus === 'copying' ? t('复制中…', 'Copying…') : copyStatus === 'copied' ? t('已复制邀请链接', 'Invitation link copied') : t('复制邀请链接', 'Copy invitation link')}</button>
  <p class={['mt-3 min-h-[1.8em] text-[12px] leading-[1.8]', copyStatus === 'manual' ? 'text-warning-text' : 'text-green']} role="status" aria-live="polite" aria-atomic="true">{copyStatus === 'copied' ? t('已复制，可直接粘贴分享给同伴。', 'Copied. Paste it to share with your teammates.') : copyStatus === 'manual' ? t('浏览器未允许自动复制。链接已选中，可长按或使用复制快捷键。', 'Your browser blocked automatic copying. The link is selected; long-press it or use your copy shortcut.') : ''}</p>
</dialog>
<dialog bind:this={notesDialog} class="max-md:px-5 max-md:py-6">
  <div class="flex items-center justify-between gap-[15px]"><h2 class="text-[22px] max-md:text-[21px]">{t('主持人私密笔记', 'Private GM notes')}</h2><button class="-my-1.5 -mr-1.5 ml-0 flex border-0 bg-transparent p-2.5 text-muted" onclick={() => notesDialog.close()} aria-label={t('关闭笔记', 'Close notes')}><Icon icon={faXmark} size={21} /></button></div>
  <p class="mt-[13px] text-[12px] text-muted">{t('只向主持人同步，也会包含在完整存档中。', 'Shared only with GMs and included in full saves.')}</p>
  <form class="[&>.btn]:mt-[15px]" onsubmit={async (e) => { e.preventDefault(); if (await command('notes', { text: notesDraft }, notesRevision)) notesDialog.close(); }}><label for="gm-notes">{t('本场备注', 'Session notes')}</label><textarea class="max-md:text-[16px]" id="gm-notes" bind:value={notesDraft} maxlength="8000" rows="10"></textarea>{#if notesRevision !== game.revision}<p class="field-hint">{t('房间有更新；保存前请重新确认版本。', 'The room has updated; confirm the new version before saving.')}</p><button type="button" class="btn secondary" onclick={() => notesRevision = game.revision}>{t('已核对最新进度', 'Reviewed latest progress')}</button>{/if}<button class="btn primary" disabled={locked || notesRevision !== game.revision}>{t('保存笔记', 'Save notes')}</button></form>
</dialog>
