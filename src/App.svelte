<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from './components/Icon.svelte';
  import { faCircleExclamation, faLanguage, faXmark } from '@fortawesome/free-solid-svg-icons';
  import { locale, syncBrowserLocale } from './lib/i18n';
  import { room, session, notice, resume, disconnect, clearSession } from './lib/client';
  import { confirmDraftNavigation } from './lib/room-drafts';
  import Brand from './components/Brand.svelte';
  import Home from './components/Home.svelte';
  import Room from './components/Room.svelte';
  let joinCode = $state(/^\/room\/(\d{4})/.exec(location.pathname)?.[1] ?? '');
  onMount(() => {
    const stopLocaleSync = syncBrowserLocale();
    const route = () => {
      const code = /^\/room\/(\d{4})/.exec(location.pathname)?.[1];
      if (code !== $session?.code && !confirmDraftNavigation()) { history.replaceState({}, '', $session ? `/room/${$session.code}` : '/'); return; }
      if (code) { joinCode = code; resume(code); } else { clearSession(); joinCode = ''; }
    };
    route(); window.addEventListener('popstate', route);
    return () => { stopLocaleSync(); window.removeEventListener('popstate', route); disconnect(); };
  });
</script>
<a href="#main" class="fixed -top-20 left-3 z-100 bg-surface p-3.5 focus:top-3">{$locale === 'zh-CN' ? '跳到主要内容' : 'Skip to content'}</a>
{#if $room}
  {#key `${$room.id}:${$room.me}`}<Room game={$room} />{/key}
{:else}
  <div class="flex min-h-svh flex-col bg-landing text-[#ecf2e9]">
    <header class="flex h-[100px] items-center justify-between gap-5 border-b border-[#ffffff0e] px-[clamp(24px,5.5vw,96px)] max-lg:h-[85px] max-lg:px-7 max-md:h-[76px] max-md:px-[22px]">
      <Brand />
      <div class="flex items-center gap-8 max-md:gap-3">
        <span class="text-[12px] text-[#b3c8c4] max-xl:text-[10px] max-md:hidden">{$locale === 'zh-CN' ? '一次关于证据与责任的冒险' : 'A story of evidence & responsibility'}</span>
        <button class="flex min-h-[38px] min-w-16 items-center justify-center gap-[7px] rounded-md border border-[#ffffff24] bg-[#ffffff07] p-2 text-[12px] text-inherit hover:bg-[#ffffff15]" onclick={() => locale.set($locale === 'zh-CN' ? 'en' : 'zh-CN')}><Icon icon={faLanguage} size={16} />{$locale === 'zh-CN' ? 'EN' : '中文'}</button>
      </div>
    </header>
    <Home {joinCode} />
    <footer class="flex justify-between gap-5 border-t border-[#ffffff0c] px-[clamp(24px,5.5vw,96px)] py-5 text-[10px] text-[#8eaca6] max-md:gap-[15px] max-md:px-[22px] max-md:py-[19px] max-md:text-[8px]"><span>ENGR 4010 · Guardians Guild</span><span>{$locale === 'zh-CN' ? '在不确定中，照顾彼此。' : 'Look after each other, through uncertainty.'}</span></footer>
  </div>
{/if}
{#if $notice}
  <div class={['fixed bottom-[25px] left-1/2 z-100 flex w-max max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-2.5 rounded-[9px] border border-[#72957f] bg-[#153e49] px-[17px] py-4 text-[12px] leading-[1.7] text-[#e1ebde] shadow-[0_8px_30px_#14313a30] max-md:gap-2 max-md:px-3.5 max-md:py-[13px] max-md:text-[11px]', $room ? 'max-md:bottom-[85px]' : 'max-md:bottom-5']} role="status">
    <Icon icon={faCircleExclamation} size={19} class="max-md:w-[17px]" />
    <span class="max-w-[520px]">{$notice[$locale]}</span>
    <button class="ml-[5px] flex size-8 shrink-0 items-center justify-center border-0 bg-transparent text-[#9ebba4] max-md:ml-0" aria-label={$locale === 'zh-CN' ? '关闭提示' : 'Dismiss message'} onclick={() => notice.set(null)}><Icon icon={faXmark} size={17} /></button>
  </div>
{/if}
