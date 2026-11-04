import { beforeAll, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { compile } from 'tailwindcss';
import { parse } from 'svelte/compiler';

const root = resolve(import.meta.dir, '..');
const stylesheet = readFileSync(resolve(root, 'src/app.css'), 'utf8');
const componentPaths = [...new Bun.Glob('src/**/*.svelte').scanSync({ cwd: root })].sort();
const components = new Map<string, { source: string; ast: ReturnType<typeof parse> }>();
// Give each component its own budget for slow ARM64/QEMU builds.
const componentTimeout = 15_000;
let generated = '';

beforeAll(async () => {
  const compiler = await compile(stylesheet, {
    base: root,
    async loadStylesheet(id, base) {
      const path = id === 'tailwindcss' ? Bun.resolveSync('tailwindcss/index.css', root) : resolve(base, id);
      return { path, base: dirname(path), content: readFileSync(path, 'utf8') };
    }
  });
  generated = compiler.build([
    'btn', 'primary', 'choice', 'surface', 'gm-details', 'panel-heading',
    'max-md:px-5', 'max-[360px]:px-4', 'min-[1700px]:pt-[50px]',
    'motion-safe:animate-dice-roll', 'motion-safe:animate-spin',
    'aria-pressed:bg-selected', 'aria-[current=page]:text-green'
  ]);
});

function component(path: string) {
  let cached = components.get(path);
  if (!cached) {
    const source = readFileSync(resolve(root, path), 'utf8');
    cached = { source, ast: parse(source) };
    components.set(path, cached);
  }
  return cached;
}

function walkMarkup(value: unknown, visit: (node: Record<string, unknown>) => void) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach(item => walkMarkup(item, visit)); return; }
  const node = value as Record<string, unknown>;
  visit(node);
  // Attribute values, text and JavaScript expressions cannot contain markup attributes.
  if (['Attribute', 'StyleDirective', 'Class', 'Text'].includes(String(node.type))) return;
  for (const [key, item] of Object.entries(node)) {
    if (!['expression', 'start', 'end', 'loc'].includes(key)) walkMarkup(item, visit);
  }
}

function inlineStyles(ast: ReturnType<typeof parse>) {
  const staticStyles: string[] = [], dynamicStyles: string[] = [];
  walkMarkup(ast.html, node => {
    if (node.type === 'Attribute' && node.name === 'style') staticStyles.push(String(node.name));
    if (node.type === 'StyleDirective') dynamicStyles.push(String(node.name));
  });
  return { staticStyles, dynamicStyles };
}

test('shared stylesheet keeps widget layouts out of CSS and defines primitives only through Tailwind', () => {
  expect(stylesheet).toContain('@import "tailwindcss"');
  expect(stylesheet).toContain('source("./")');
  expect(stylesheet).not.toMatch(/^\s*\.[a-z][\w-]*\s*[{,:>]/m);
  const primitives = [...stylesheet.matchAll(/@utility\s+([\w-]+)\s*\{([^}]+)\}/g)];
  expect(primitives.length).toBeGreaterThan(0);
  for (const [, , body] of primitives) expect(body!.trim()).toMatch(/^@apply\s+[\s\S]+;$/);
});

test.each(componentPaths)('%s has no handwritten CSS; only the ballot may bind its width', path => {
  const { ast } = component(path);
  const { staticStyles, dynamicStyles } = inlineStyles(ast);
  expect(ast.css ?? null).toBeNull();
  expect(staticStyles).toEqual([]);
  expect(dynamicStyles).toEqual(path === 'src/components/PollPanel.svelte' ? ['width'] : []);
}, componentTimeout);

test('markup inspection still detects style blocks, static attributes and directives in nested branches and snippets', () => {
  const ast = parse(`
    {#if visible}
      <section><span style="color: red">Text</span></section>
    {:else}
      {#each sizes as size}<p style:height={size}>Item</p>{/each}
    {/if}
    {#snippet row()}<article style:width={'50%'}><i style="opacity: .5"></i></article>{/snippet}
    <style>p { color: red; }</style>
  `);
  expect(ast.css ?? null).not.toBeNull();
  expect(inlineStyles(ast)).toEqual({ staticStyles: ['style', 'style'], dynamicStyles: ['height', 'width'] });
});

test('markup traversal skips JavaScript expressions without skipping their surrounding elements', () => {
  const ast = parse(`<button onclick={() => run({ style: 'not a markup attribute' })}>Action</button>{#if visible()}<span>{format(value)}</span>{/if}`);
  const types = new Set<string>(), elements: string[] = [];
  walkMarkup(ast.html, node => {
    types.add(String(node.type));
    if (node.type === 'Element') elements.push(String(node.name));
  });
  expect(types.has('CallExpression')).toBe(false);
  expect(types.has('ArrowFunctionExpression')).toBe(false);
  expect(elements).toEqual(['button', 'span']);
  expect(inlineStyles(ast)).toEqual({ staticStyles: [], dynamicStyles: [] });
});

test('narrow phone utilities override tablet utilities with consistently ordered pixel breakpoints', () => {
  const tablet = generated.indexOf('.max-md\\:px-5');
  const phone = generated.indexOf('.max-\\[360px\\]\\:px-4');
  expect(tablet).toBeGreaterThan(-1);
  expect(phone).toBeGreaterThan(tablet);
  expect(generated).toContain('@media (width < 768px)');
  expect(generated).toContain('@media (width < 360px)');
  expect(generated).toContain('@media (width >= 1700px)');
});

test('theme, selected controls, focus indicators and disabled feedback compile from the actual stylesheet', () => {
  expect(generated).toContain('prefers-color-scheme: dark');
  expect(generated).toMatch(/--paper:\s*#f3f6f3/);
  expect(generated).toMatch(/--paper:\s*#101c20/);
  expect(generated).toContain('[aria-pressed="true"]');
  expect(generated).toContain('[aria-current="page"]');
  expect(generated).toContain('background-color: var(--selected)');
  expect(generated).toContain(':focus-visible');
  expect(generated).toContain('outline-width: 3px');
  expect(generated).toContain('opacity: .53');
});

test('reduced-motion mode disables animations and transitions even when a utility requests animation', () => {
  expect(generated).toContain('dice-roll 700ms cubic-bezier(.2, .7, .3, 1)');
  expect(generated).toContain('@media (prefers-reduced-motion: no-preference)');
  const reduced = generated.match(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\*, ::before, ::after\s*\{([^}]+)/)?.[1];
  expect(reduced).toBeDefined();
  expect(reduced).toContain('animation: none !important');
  expect(reduced).toContain('transition-property: none !important');
  expect(reduced).toContain('transition-duration: 0ms !important');
  expect(reduced).toContain('scroll-behavior: auto !important');
});

test('dice animation is applied to the icon component, never to the result number', () => {
  const { source, ast } = component('src/components/CheckPanel.svelte');
  const animated: string[] = [];
  walkMarkup(ast.html, node => {
    if (!Array.isArray(node.attributes)) return;
    for (const attribute of node.attributes as { name?: string; start: number; end: number }[]) {
      if (attribute.name === 'class' && source.slice(attribute.start, attribute.end).includes('animate-dice-roll')) animated.push(String(node.name));
    }
  });
  expect(animated).toEqual(['Icon']);
  expect(component('src/components/Icon.svelte').source).toContain('motion-safe:animate-spin');
}, componentTimeout);
