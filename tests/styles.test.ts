import { beforeAll, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { compile } from 'tailwindcss';
import { parse } from 'svelte/compiler';

const root = resolve(import.meta.dir, '..');
const stylesheet = readFileSync(resolve(root, 'src/app.css'), 'utf8');
const componentPaths = [...new Bun.Glob('src/**/*.svelte').scanSync({ cwd: root })];
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

function walk(value: unknown, visit: (node: Record<string, unknown>) => void) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach(item => walk(item, visit)); return; }
  const node = value as Record<string, unknown>;
  visit(node);
  Object.values(node).forEach(item => walk(item, visit));
}

test('shared stylesheet keeps widget layouts out of CSS and defines primitives only through Tailwind', () => {
  expect(stylesheet).toContain('@import "tailwindcss"');
  expect(stylesheet).toContain('source("./")');
  expect(stylesheet).not.toMatch(/^\s*\.[a-z][\w-]*\s*[{,:>]/m);
  const primitives = [...stylesheet.matchAll(/@utility\s+([\w-]+)\s*\{([^}]+)\}/g)];
  expect(primitives.length).toBeGreaterThan(0);
  for (const [, , body] of primitives) expect(body!.trim()).toMatch(/^@apply\s+[\s\S]+;$/);
});

test('components have no handwritten style blocks or static inline CSS; only ballot width is data-driven', () => {
  const dynamicStyles: string[] = [];
  for (const path of componentPaths) {
    const ast = parse(readFileSync(resolve(root, path), 'utf8'));
    expect(ast.css ?? null).toBeNull();
    walk(ast.html, node => {
      if (node.type === 'Attribute') expect(node.name).not.toBe('style');
      if (node.type === 'StyleDirective') dynamicStyles.push(`${path}:${String(node.name)}`);
    });
  }
  expect(dynamicStyles).toEqual(['src/components/PollPanel.svelte:width']);
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
  const source = readFileSync(resolve(root, 'src/components/CheckPanel.svelte'), 'utf8');
  const animated: string[] = [];
  walk(parse(source).html, node => {
    if (!Array.isArray(node.attributes)) return;
    for (const attribute of node.attributes as { name?: string; start: number; end: number }[]) {
      if (attribute.name === 'class' && source.slice(attribute.start, attribute.end).includes('animate-dice-roll')) animated.push(String(node.name));
    }
  });
  expect(animated).toEqual(['Icon']);
  expect(readFileSync(resolve(root, 'src/components/Icon.svelte'), 'utf8')).toContain('motion-safe:animate-spin');
});
