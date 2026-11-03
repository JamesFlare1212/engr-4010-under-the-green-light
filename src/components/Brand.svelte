<script lang="ts">
  import { faShieldHeart } from '@fortawesome/free-solid-svg-icons';
  import Icon from './Icon.svelte';
  import { leave } from '../lib/client';
  let { small = false }: { small?: boolean } = $props();
</script>
<a href="/" class={['flex items-center font-[650] tracking-[-.04em] leading-[1.1]', small ? 'min-w-[185px] gap-[11px] text-[18px] max-xl:min-w-40 max-md:min-w-0 max-md:gap-1.5 max-md:text-[16px]' : 'gap-[11px] text-[21px] max-md:text-[19px]']} aria-label="Guardians · Under the Green Light" onclick={(event) => { if (location.pathname.startsWith('/room/')) { event.preventDefault(); leave(); } }}>
  <Icon icon={faShieldHeart} size={small ? 30 : 38} class={small ? 'text-[#a9c9b8] max-md:size-[25px]' : 'text-[#a9c9b8] max-md:w-[33px]'} />
  <span class={small ? 'max-[360px]:text-[14px]' : ''}>Guardians<span class={['mt-1.5 block font-normal tracking-[.09em] opacity-[.68]', small ? 'text-[9px] max-md:text-[6px] max-[360px]:text-[5px]' : 'text-[9px] max-md:text-[8px]']}>Under the Green Light</span></span>
</a>
