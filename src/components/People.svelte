<script lang="ts">
  import { untrack } from 'svelte';
  import { bi } from '../../shared/types';
  import { createRoomDrafts, type RoomDrafts } from '../lib/room-drafts';
  import Icon from './Icon.svelte';
  import { faCheck, faCrown, faPencil, faUsers } from '@fortawesome/free-solid-svg-icons';
  import type { RoomView, Role } from '../../shared/types';
  import { characters, roles } from '../../shared/content';
  import { locale } from '../lib/i18n';
  import { command, busy, connection } from '../lib/client';
  let { game, gm = false, roomDrafts = createRoomDrafts(() => game) }: { game: RoomView; gm?: boolean; roomDrafts?: RoomDrafts } = $props();
  const editor = untrack(() => roomDrafts.editor('profile', () => ({ name: '', character: 'engineer' }), game.revision, bi('个人资料', 'My profile')));
  const editing = $derived($editor.editing), name = $derived($editor.value.name), character = $derived($editor.value.character);
  const me = $derived(game.members.find(m => m.id === game.me)!);
  const t = (zh: string, en: string) => $locale === 'zh-CN' ? zh : en;
  const locked = $derived($busy || $connection !== 'live');
  function toggleProfile() { if (editing) editor.cancel(); else editor.begin({ name: me.name, character: me.character }, game.revision); }
  async function saveProfile(event: SubmitEvent) {
    event.preventDefault(); if (locked) return;
    await editor.save((value, revision) => command('profile', value, revision));
  }
</script>
<div class="section-title"><div><h2>{t('同一支救援队', 'One rescue team')}</h2><p>{t('身份用于分工，不限制技能。每个人都可以为方案提供依据。', 'Roles support teamwork; they do not restrict skills. Everyone can contribute.')}</p></div><button class="btn secondary" onclick={toggleProfile}><Icon icon={faPencil} size={16} />{t('我的身份', 'My profile')}</button></div>
{#if editing}
  <form class="surface mb-5 [&>label:first-child]:mt-0 max-md:[&_input]:text-[16px] max-md:[&_select]:text-[16px]" onsubmit={saveProfile}>
    <label for="profile-name">{t('名字', 'Name')}</label><input id="profile-name" bind:value={() => name, value => editor.patch('name', value)} maxlength="32" required />
    <fieldset><legend>{t('角色分工', 'Character role')}</legend><div class="grid grid-cols-3 gap-2.5 max-lg:grid-cols-2 max-md:gap-[9px]">{#each characters as c}<button type="button" class="choice" aria-pressed={character === c.id} onclick={() => editor.patch('character', c.id)}><strong>{c.name[$locale]}</strong><small>{c.description[$locale]}</small></button>{/each}</div></fieldset>
    <button class="btn primary mt-[18px]" disabled={locked}><Icon icon={faCheck} size={16} />{t('保存身份', 'Save profile')}</button>
  </form>
{/if}
<div class="mt-5">
  {#each game.members as member, i}
    <article class="flex items-center gap-3 border-b border-line py-[17px] max-md:flex-wrap max-md:gap-2.5">
      <div class="avatar max-md:size-[37px] max-md:text-[17px]">{member.name.slice(0, 1).toUpperCase()}<span class={['absolute right-0 bottom-px size-[9px] rounded-full border-2 border-paper', game.online.includes(member.id) ? 'bg-online-dot' : 'bg-offline-dot']}></span></div>
      <div class="min-w-0 flex-1">
        <strong class="flex items-center gap-[7px] text-[14px] wrap-anywhere">{member.name}{member.id === game.me ? t('（你）', ' (you)') : ''}{#if member.id === game.hostId}<Icon icon={faCrown} size={13} />{/if}</strong>
        <span class="mt-1.5 block text-[10px] text-muted">{member.role === 'player' ? characters.find(c => c.id === member.character)?.name[$locale] : roles[member.role][$locale]}<span class="ml-[11px] text-muted max-md:mt-[3px] max-md:ml-0 max-md:block">{game.online.includes(member.id) ? t('在线', 'Online') : t('离线 · 保留席位', 'Offline · seat retained')}</span></span>
      </div>
      <span class="text-[10px] whitespace-nowrap text-muted max-md:text-[9px] max-[360px]:hidden">{t(`主导 ${member.leads} 次`, `Led ${member.leads}`)}</span>
      {#if gm && game.me === game.hostId && member.id !== game.hostId}
        <label class="sr-only" for={`role-${i}`}>{t('分配身份：', 'Assign role: ')}{member.name}</label><select id={`role-${i}`} class="min-h-9 w-[95px] px-2.5 py-[7px] text-[10px] max-md:min-h-10 max-md:w-[86px]" value={member.role} disabled={locked} onchange={(e) => command('role', { memberId: member.id, role: e.currentTarget.value as Role })}>{#each ['player', 'gm', 'spectator'] as role}<option value={role}>{roles[role as Role][$locale]}</option>{/each}</select>
      {:else}<span class="pill text-[9px]">{roles[member.role][$locale]}</span>{/if}
    </article>
  {/each}
</div>
{#if game.recovery}<p class="my-4 rounded-lg border border-line bg-soft p-4 text-xs text-muted">{t('这是从存档恢复的新房间。请邀请成员、补齐主持席位，并重新开放尚未完成的申请或路线投票；过去的署名保留在历史成员中。', 'This room was restored from a save. Invite the team, fill the GM seats, and reopen pending recruitment or route voting. Past authors remain in historical members.')}</p>{/if}
{#if game.archivedMembers?.length}<details class="mt-6 rounded-lg border border-line bg-soft p-4"><summary class="cursor-pointer text-sm">{t('历史成员 · 不占用当前席位', 'Historical members · no active seats')} ({game.archivedMembers.length})</summary><p class="mt-2 text-xs text-muted">{t('保留过去行动、投票、日志和反思的署名；这些身份没有当前登录权限，也不参与新的申请或投票。', 'Past actions, ballots, logs and reflections retain their authors. These identities have no current login permissions and do not join new recruitment or votes.')}</p><ul class="mt-3 space-y-2 text-sm">{#each game.archivedMembers as member}<li class="flex flex-wrap justify-between gap-2"><span>{member.name}</span><small class="text-muted">{t(`主导 ${member.leads} 次`, `Led ${member.leads}`)}</small></li>{/each}</ul></details>{/if}
<div class="inline-info"><Icon icon={faUsers} size={20} /><p>{t('优先邀请还没主导的人申请。多人申请时公平随机抽选；精简版由两人共同主导，只有一人掷骰。离线不会丢失身份或已做决定。', 'Invite people who have not led yet. Multiple volunteers enter a fair random draw. Short mode pairs two leads, with only one rolling. Disconnecting preserves membership and decisions.')}</p></div>
