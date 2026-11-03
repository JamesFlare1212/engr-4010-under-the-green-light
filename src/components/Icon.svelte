<script lang="ts">
  import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';

  let { icon, size = 24, spin = false, class: className = '' }: { icon: IconDefinition; size?: number; spin?: boolean; class?: string } = $props();
  const paths = $derived(typeof icon.icon[4] === 'string' ? [icon.icon[4]] : icon.icon[4]);
</script>

<svg class={['inline-block shrink-0 overflow-visible align-[-.125em] origin-center', spin && 'motion-safe:animate-spin', className]} data-icon={icon.iconName} width={size} height={size}
  viewBox={`0 0 ${icon.icon[0]} ${icon.icon[1]}`} fill="currentColor" aria-hidden="true" focusable="false">
  {#each paths as path}<path d={path} />{/each}
</svg>
