<script lang="ts">
  import type { IconDefinition } from '@fortawesome/fontawesome-common-types';

  let { icon, size = 24, spin = false }: { icon: IconDefinition; size?: number; spin?: boolean } = $props();
  const paths = $derived(typeof icon.icon[4] === 'string' ? [icon.icon[4]] : icon.icon[4]);
</script>

<svg class="fa-icon" class:icon-spin={spin} data-icon={icon.iconName} width={size} height={size}
  viewBox={`0 0 ${icon.icon[0]} ${icon.icon[1]}`} fill="currentColor" aria-hidden="true" focusable="false">
  {#each paths as path}<path d={path} />{/each}
</svg>
