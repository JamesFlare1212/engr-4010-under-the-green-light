<script lang="ts">
  import { BookOpen, Files, GitBranch, Users, History, Share2, Languages, Wifi, WifiOff, LogOut, Eye, Shield, Package, Pause, Play, Download, Copy, Check, X, NotebookPen, RefreshCw, Radio, ChevronRight } from 'lucide-svelte';
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
    { id: 'story', icon: BookOpen, zh: '任务现场', en: 'The mission' }, { id: 'evidence', icon: Files, zh: '共享证据', en: 'Evidence' },
    { id: 'flow', icon: GitBranch, zh: '进度与分叉', en: 'The path' }, { id: 'people', icon: Users, zh: '救援成员', en: 'The team' }, { id: 'history', icon: History, zh: '行动记录', en: 'Activity' }
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
<div class="room-app">
  <header class="room-header"><Brand small /><div class="room-breadcrumb"><span>{t('绿灯之下', 'Under the Green Light')}</span><ChevronRight size={13} /><strong>{phaseLabels[game.phase][$locale]}</strong></div><div class="room-header-actions"><span class="sync-indicator" class:disconnected={$connection !== 'live'}>{#if $connection === 'live'}<Wifi size={14} />{:else}<WifiOff size={14} />{/if}<span>{$connection === 'live' ? t('实时同步', 'Live sync') : $connection === 'connecting' ? t('连接中', 'Connecting') : $connection === 'expired' ? t('身份已失效', 'Session expired') : t('正在重连', 'Reconnecting')}</span></span><button class="room-code-btn" onclick={() => copy(game.code)} aria-label={t('复制房间码', 'Copy room code')}>{game.code}<Copy size={13} /></button><button class="btn header-share" onclick={share}><Share2 size={16} /><span>{t('邀请', 'Invite')}</span></button><button class="lang-btn" onclick={() => locale.set($locale === 'zh-CN' ? 'en' : 'zh-CN')}><Languages size={16} />{$locale === 'zh-CN' ? 'EN' : '中文'}</button></div></header>
  {#if $connection !== 'live'}<div class="offline-banner" role="status"><WifiOff size={17} /><span>{$connection === 'expired' ? t('登录身份已失效。请返回首页重新加入。', 'Your session has expired. Return home and join again.') : t('连接中断时仍可查看已同步内容。连接恢复后自动更新，操作暂时暂停。', 'Synced content is still available. Actions pause until the connection recovers and game updates automatically.')}</span><button onclick={() => $connection === 'expired' ? leave() : resume(game.code)}>{$connection === 'expired' ? t('返回首页', 'Return home') : t('立即重连', 'Reconnect now')}</button></div>{/if}
  <div class="room-layout">
    <aside class="room-sidebar">
      <div class="room-identity"><span class="tiny-tag">Guardians Guild</span><h2>{t('绿灯之下', 'Under the Green Light')}</h2><span>{game.settings.mode === 'full' ? t('完整剧本', 'Full story') : t('精简剧本', 'Short story')}<i></i>{game.settings.gmCount === 2 ? 'Co-GM' : `${game.settings.gmCount} GM`}</span></div>
      <nav class="app-nav" aria-label={t('房间导航', 'Room navigation')}>{#each tabs as item}<button class:active={tab === item.id} aria-current={tab === item.id ? 'page' : undefined} onclick={() => navigate(item.id)}><item.icon size={19} /><span>{t(item.zh, item.en)}</span>{#if item.id === 'evidence'}<small>{game.evidence.length}</small>{:else if item.id === 'people'}<small>{game.members.length}</small>{/if}</button>{/each}</nav>
      <div class="sidebar-chapters"><span class="tiny-tag">{t('剧本进度', 'Story progress')}</span>{#each phases.filter(p => p !== 'lobby') as phase, i}<div class:chapter-current={game.phase === phase} class:chapter-done={phases.indexOf(game.phase) > phases.indexOf(phase)}><span>{String(i + 1).padStart(2, '0')}</span>{phaseLabels[phase][$locale]}</div>{/each}</div>
      <div class="sidebar-bottom">{#if me.role === 'gm'}<button class="presentation-button" onclick={() => presenting = !presenting}>{#if presenting}<Shield size={16} />{:else}<Eye size={16} />{/if}{presenting ? t('返回主持视图', 'Return to GM view') : t('切换玩家展示', 'Show player view')}</button>{/if}<div class="current-member"><span class="avatar small">{me.name.slice(0,1)}</span><div><strong>{me.name}</strong><span>{gm ? game.me === game.hostId ? t('房主 · 主持人', 'Owner · GM') : t('协作主持', 'Co-GM') : presenting ? t('玩家展示视图', 'Player presentation') : me.role === 'spectator' ? t('观察者', 'Observer') : t('救援成员', 'Team member')}</span></div><button onclick={leave} aria-label={t('离开房间（保留进度）', 'Leave room (progress saved)')}><LogOut size={17} /></button></div></div>
    </aside>
    <main id="main" class="room-main">
      <div class="sr-only" role="status">{t('当前阶段：', 'Current stage: ')}{phaseLabels[game.phase][$locale]}</div>
      <div class="mobile-mission-strip"><span><Users size={14} />{status.evacuated}/12 {t('已撤离', 'evacuated')}</span><span><Package size={14} />{game.emergencyKits} {t('份物资', 'kits')}</span><span>{game.settings.dice === 'virtual' ? t('虚拟 D20', 'Virtual D20') : t('实体 D20', 'Physical D20')}</span></div>
      <details class="compact-room-tools"><summary>{me.name} · {t('房间工具', 'Room tools')}</summary><div class="button-group">{#if me.role === 'gm'}<button class="btn secondary" onclick={() => presenting = !presenting}><Eye size={15} />{presenting ? t('返回主持视图', 'Return to GM view') : t('玩家展示', 'Player view')}</button>{/if}{#if gm}<button class="btn secondary" onclick={() => { notesDraft = game.gmNotes ?? ''; notesRevision = game.revision; notesDialog.showModal(); }}><NotebookPen size={15} />{t('私密笔记', 'Private notes')}</button><button class="btn secondary" onclick={downloadSave}><Download size={15} />{t('完整存档', 'Full save')}</button><button class="btn secondary" disabled={locked} onclick={() => command('clock')}>{game.clock.runningSince ? t('暂停计时', 'Pause timer') : t('继续计时', 'Resume timer')}</button>{/if}<button class="btn secondary" onclick={leave}><LogOut size={15} />{t('返回首页', 'Return home')}</button></div></details>
      {#if tab === 'story'}{#key game.phase}<Stage {game} {gm} onshare={share} />{/key}
      {:else if tab === 'evidence'}<Evidence {game} />
      {:else if tab === 'flow'}<Flow {game} />
      {:else if tab === 'people'}<People {game} {gm} />
      {:else}<div class="section-title"><div><h1>{t('每一步都有记录', 'A record of every step')}</h1><p>{t('决定、更正与实际后果，按时间保留。', 'Decisions, corrections and fictional outcomes stay in chronological order.')}</p></div>{#if gm}<button class="btn secondary" onclick={downloadSave}><Download size={16} />{t('完整存档', 'Full save')}</button>{/if}</div><ol class="activity-log">{#each [...game.logs].reverse() as entry}<li><span class="log-dot"></span><div><p class="[overflow-wrap:anywhere]">{entry.text[$locale]}</p><small>{game.members.find(m => m.id === entry.actorId)?.name ?? t('系统', 'System')}<span>·</span><time datetime={new Date(entry.at).toISOString()}>{new Date(entry.at).toLocaleTimeString($locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time></small></div></li>{/each}</ol>{/if}
      <footer class="room-footnote"><span>Heliora Prime · The Shell</span><span>{t('保护生命，忠诚协作，如实沟通。', 'Protect life. Work together. Speak truthfully.')}</span></footer>
    </main>
    <aside class="mission-aside" aria-label={t('任务状态', 'Mission status')}><div class="mission-heading"><Radio size={17} /><span>{t('现场概况', 'Field status')}</span><span class="signal-dot"></span></div>
      <div class="status-headcount"><span>{t('维修人员', 'Maintenance workers')}</span><strong>{status.evacuated}<small>/ 12</small></strong><p>{t('已安全撤离', 'Safely evacuated')}</p><div class="people-dots">{#each Array(12) as _, i}<span class:rescued={i < status.evacuated}></span>{/each}</div><small>{game.checks.some(c => c.kind === 'execution' && c.objective === 'evacuation' && c.result) ? t(`${status.waiting} 人待援 · ${status.observation} 人需观察`, `${status.waiting} awaiting rescue · ${status.observation} need observation`) : t('12 人待转移，其中 2 人需要协助', '12 to move; 2 need assistance')}</small></div>
      <div class="status-resource"><span><Package size={17} />{t('应急物资', 'Emergency kits')}</span><div>{#each [0, 1] as i}<span class:kit-empty={i >= game.emergencyKits}><Package size={20} /></span>{/each}<strong>{game.emergencyKits} / 2</strong></div><p>{t('共享补救机会，每次提升一档。', 'Shared help. Improve one tier per check.')}</p></div>
      <div class="status-isolation"><span><Shield size={16} />{t('设施隔离', 'Facility isolation')}</span><strong>{isolationLabels[status.isolation][$locale]}</strong></div>
      <div class="status-time"><div><span>{t('课堂用时', 'Session time')}</span>{#if gm}<button disabled={locked} onclick={() => command('clock')} aria-label={game.clock.runningSince ? t('暂停课堂计时', 'Pause session timer') : t('继续课堂计时', 'Resume session timer')}>{#if game.clock.runningSince}<Pause size={15} />{:else}<Play size={15} />{/if}</button>{/if}</div><strong>{String(Math.floor(elapsed / 60)).padStart(2,'0')}<span>:</span>{String(elapsed % 60).padStart(2,'0')}</strong><p>{t('独立于故事中的十二分钟。', 'Separate from the fictional twelve minutes.')}</p></div>
      <div class="safeguard-note"><Shield size={18} /><p>{t('避难室保障约两小时。诊所独立备用供电 20 分钟。', 'Refuge: roughly two hours of protection. Clinic: 20-minute independent backup.')}</p></div>
      {#if gm}<button class="aside-button" onclick={() => { notesDraft = game.gmNotes ?? ''; notesRevision = game.revision; notesDialog.showModal(); }}><NotebookPen size={16} />{t('主持人私密笔记', 'Private GM notes')}</button><button class="aside-button" onclick={downloadSave}><Download size={16} />{t('导出完整存档', 'Export full save')}</button>{/if}
    </aside>
  </div>
</div>
<dialog bind:this={shareDialog} class="share-dialog"><div class="dialog-head"><h2>{t('邀请同伴加入', 'Invite your teammates')}</h2><button onclick={() => shareDialog.close()} aria-label={t('关闭邀请', 'Close invitation')}><X size={21} /></button></div><p>{t('扫描二维码，或输入四位房间码。', 'Scan the QR code or enter the four-digit code.')}</p><div class="qr-frame">{#if qr && !qrError}<img src={qr} width="240" height="240" alt={t('加入房间的二维码', 'QR code to join the room')} />{:else}<p>{t('请填写有效的 http / https 加入地址。', 'Enter a valid http / https invitation address.')}</p>{/if}</div><div class="share-room-code">{game.code}</div><label for="join-url">{t('加入链接', 'Invitation link')}</label><div class="copy-link-field"><input id="join-url" bind:this={joinInput} bind:value={joinUrl} type="url" /><button class="btn secondary" onclick={copyInvite} disabled={copyStatus === 'copying'} aria-label={t('复制加入链接', 'Copy invitation link')}>{#if copyStatus === 'copied'}<Check size={18} />{:else}<Copy size={18} />{/if}</button></div>{#if /localhost|127\.0\.0\.1/.test(joinUrl)}<p class="field-hint">{t('手机加入时，请将 localhost 改为电脑的局域网 IP；两台设备需在同一网络，或使用部署后的地址。', 'For a phone, replace localhost with your computer’s LAN IP on the same network, or use your deployed address.')}</p>{/if}<button class="btn primary wide" onclick={copyInvite} disabled={copyStatus === 'copying'} aria-busy={copyStatus === 'copying'}>{#if copyStatus === 'copied'}<Check size={17} />{:else}<Share2 size={17} />{/if}{copyStatus === 'copying' ? t('复制中…', 'Copying…') : copyStatus === 'copied' ? t('已复制邀请链接', 'Invitation link copied') : t('复制邀请链接', 'Copy invitation link')}</button><p class="copy-feedback" class:copy-failed={copyStatus === 'manual'} role="status" aria-live="polite" aria-atomic="true">{copyStatus === 'copied' ? t('已复制，可直接粘贴分享给同伴。', 'Copied. Paste it to share with your teammates.') : copyStatus === 'manual' ? t('浏览器未允许自动复制。链接已选中，可长按或使用复制快捷键。', 'Your browser blocked automatic copying. The link is selected; long-press it or use your copy shortcut.') : ''}</p></dialog>
<dialog bind:this={notesDialog} class="notes-dialog"><div class="dialog-head"><h2>{t('主持人私密笔记', 'Private GM notes')}</h2><button onclick={() => notesDialog.close()} aria-label={t('关闭笔记', 'Close notes')}><X size={21} /></button></div><p>{t('只向主持人同步，也会包含在完整存档中。', 'Shared only with GMs and included in full saves.')}</p><form onsubmit={async (e) => { e.preventDefault(); if (await command('notes', { text: notesDraft }, notesRevision)) notesDialog.close(); }}><label for="gm-notes">{t('本场备注', 'Session notes')}</label><textarea id="gm-notes" bind:value={notesDraft} maxlength="8000" rows="10"></textarea>{#if notesRevision !== game.revision}<p class="field-hint">{t('房间有更新；保存前请重新确认版本。', 'The room has updated; confirm the new version before saving.')}</p><button type="button" class="btn secondary" onclick={() => notesRevision = game.revision}>{t('已核对最新进度', 'Reviewed latest progress')}</button>{/if}<button class="btn primary" disabled={locked || notesRevision !== game.revision}>{t('保存笔记', 'Save notes')}</button></form></dialog>
