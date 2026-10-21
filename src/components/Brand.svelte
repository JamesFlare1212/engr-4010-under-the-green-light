<script lang="ts">import { leave } from '../lib/client'; let { small = false }: { small?: boolean } = $props();</script>
<a href="/" class="brand" aria-label="Guardians · Under the Green Light" onclick={(event) => { if (location.pathname.startsWith('/room/')) { event.preventDefault(); leave(); } }}>
  <svg width={small ? 30 : 38} height={small ? 30 : 38} viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M5 32a19 19 0 0 1 38 0M14 32a10 10 0 0 1 20 0M5 39h38" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><circle cx="24" cy="10" r="3" fill="currentColor"/></svg>
  <span>Guardians<span class="brand-sub">Under the Green Light</span></span>
</a>
