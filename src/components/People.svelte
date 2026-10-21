<script lang="ts">
  import Icon from './Icon.svelte';
  import { faCheck, faCrown, faPencil, faUsers } from '@fortawesome/free-solid-svg-icons';
  import type { RoomView, Role } from '../../shared/types';
  import { characters, roles } from '../../shared/content';
  import { locale } from '../lib/i18n';
  import { command, busy, connection } from '../lib/client';
  let { game, gm = false }: { game: RoomView; gm?: boolean } = $props();
  let editing = $state(false), name = $state(''), character = $state('engineer');
  const me = $derived(game.members.find(m => m.id === game.me)!);
  const t = (zh: string, en: string) => $locale === 'zh-CN' ? zh : en;
  const locked = $derived($busy || $connection !== 'live');
</script>
<div class="section-title"><div><h2>{t('同一支救援队', 'One rescue team')}</h2><p>{t('身份用于分工，不限制技能。每个人都可以为方案提供依据。', 'Roles support teamwork; they do not restrict skills. Everyone can contribute.')}</p></div><button class="btn secondary" onclick={() => { name = me.name; character = me.character; editing = !editing; }}><Icon icon={faPencil} size={16} />{t('我的身份', 'My profile')}</button></div>
{#if editing}<form class="profile-form surface" onsubmit={async (e) => { e.preventDefault(); if (await command('profile', { name, character })) editing = false; }}><label for="profile-name">{t('名字', 'Name')}</label><input id="profile-name" bind:value={name} maxlength="32" required /><fieldset><legend>{t('角色分工', 'Character role')}</legend><div class="character-grid">{#each characters as c}<button type="button" class="choice" class:chosen={character === c.id} aria-pressed={character === c.id} onclick={() => character = c.id}><strong>{c.name[$locale]}</strong><small>{c.description[$locale]}</small></button>{/each}</div></fieldset><button class="btn primary" disabled={locked}><Icon icon={faCheck} size={16} />{t('保存身份', 'Save profile')}</button></form>{/if}
<div class="crew-list">{#each game.members as member, i}<article class="crew-member">
  <div class="avatar" class:gm-avatar={member.role === 'gm'}>{member.name.slice(0, 1).toUpperCase()}<span class:online={game.online.includes(member.id)}></span></div>
  <div class="member-info"><strong>{member.name}{member.id === game.me ? t('（你）', ' (you)') : ''}{#if member.id === game.hostId}<Icon icon={faCrown} size={13} />{/if}</strong><span>{member.role === 'player' ? characters.find(c => c.id === member.character)?.name[$locale] : roles[member.role][$locale]}<span class="member-connection">{game.online.includes(member.id) ? t('在线', 'Online') : t('离线 · 保留席位', 'Offline · seat retained')}</span></span></div>
  <span class="lead-counter">{t(`主导 ${member.leads} 次`, `Led ${member.leads}`)}</span>
  {#if gm && game.me === game.hostId && member.id !== game.hostId}<label class="sr-only" for={`role-${i}`}>{t('分配身份：', 'Assign role: ')}{member.name}</label><select id={`role-${i}`} class="role-select" value={member.role} disabled={locked} onchange={(e) => command('role', { memberId: member.id, role: e.currentTarget.value as Role })}>{#each ['player', 'gm', 'spectator'] as role}<option value={role}>{roles[role as Role][$locale]}</option>{/each}</select>{:else}<span class="pill">{roles[member.role][$locale]}</span>{/if}
</article>{/each}</div>
<div class="inline-info"><Icon icon={faUsers} size={20} /><p>{t('优先邀请还没主导的人申请。多人申请时公平随机抽选；精简版由两人共同主导，只有一人掷骰。离线不会丢失身份或已做决定。', 'Invite people who have not led yet. Multiple volunteers enter a fair random draw. Short mode pairs two leads, with only one rolling. Disconnecting preserves membership and decisions.')}</p></div>
