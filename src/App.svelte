<script lang="ts">
  import { onMount } from 'svelte';
  import { Languages, X, AlertCircle } from 'lucide-svelte';
  import { locale, syncBrowserLocale } from './lib/i18n';
  import { room, session, notice, resume, disconnect } from './lib/client';
  import Brand from './components/Brand.svelte';
  import Home from './components/Home.svelte';
  import Room from './components/Room.svelte';
  let joinCode = $state(/^\/room\/(\d{4})/.exec(location.pathname)?.[1] ?? '');
  onMount(() => {
    const stopLocaleSync = syncBrowserLocale();
    const route = () => { const code = /^\/room\/(\d{4})/.exec(location.pathname)?.[1]; if (code) { joinCode = code; resume(code); } else { disconnect(); room.set(null); session.set(null); joinCode = ''; } };
    route(); window.addEventListener('popstate', route);
    return () => { stopLocaleSync(); window.removeEventListener('popstate', route); disconnect(); };
  });
</script>
<a href="#main" class="skip-link">{$locale === 'zh-CN' ? '跳到主要内容' : 'Skip to content'}</a>
{#if $room}
  <Room game={$room} />
{:else}
  <div class="landing"><header class="landing-header"><Brand /><div class="header-end"><span class="guild-tag">{$locale === 'zh-CN' ? '一次关于证据与责任的冒险' : 'A story of evidence & responsibility'}</span><button class="lang-btn" onclick={() => locale.set($locale === 'zh-CN' ? 'en' : 'zh-CN')}><Languages size={16} />{$locale === 'zh-CN' ? 'EN' : '中文'}</button></div></header><Home {joinCode} /><footer class="landing-footer"><span>ENGR 4010 · Guardians Guild</span><span>{$locale === 'zh-CN' ? '在不确定中，照顾彼此。' : 'Look after each other, through uncertainty.'}</span></footer></div>
{/if}
{#if $notice}<div class="toast" role="status"><AlertCircle size={19} /><span>{$notice[$locale]}</span><button aria-label={$locale === 'zh-CN' ? '关闭提示' : 'Dismiss message'} onclick={() => notice.set(null)}><X size={17} /></button></div>{/if}
