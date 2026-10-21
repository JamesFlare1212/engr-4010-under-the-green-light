<script lang="ts">
  import { faShieldHeart } from '@fortawesome/free-solid-svg-icons';
  import Icon from './Icon.svelte';
  import { leave } from '../lib/client';
  let { small = false }: { small?: boolean } = $props();
</script>
<a href="/" class="brand" aria-label="Guardians · Under the Green Light" onclick={(event) => { if (location.pathname.startsWith('/room/')) { event.preventDefault(); leave(); } }}>
  <Icon icon={faShieldHeart} size={small ? 30 : 38} />
  <span>Guardians<span class="brand-sub">Under the Green Light</span></span>
</a>
