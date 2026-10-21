import { test, expect } from 'bun:test';
import * as content from '../shared/content';
import seed from '../content/scenario.zh-CN.json';
test('所有应用双语条目都有非空的中文和英文，不以缺省回退掩盖缺失翻译', () => {
  let count = 0;
  function visit(value: unknown) {
    if (!value || typeof value !== 'object') return;
    const item = value as Record<string, unknown>;
    if ('zh-CN' in item || 'en' in item) { expect(typeof item['zh-CN']).toBe('string'); expect(typeof item.en).toBe('string'); expect((item['zh-CN'] as string).length).toBeGreaterThan(0); expect((item.en as string).length).toBeGreaterThan(0); count++; }
    else Object.values(item).forEach(visit);
  }
  Object.values(content).forEach(visit); expect(count).toBeGreaterThan(100);
});
test('网页改编保留证据、路线、NPC、目标 ID 与原英文开场', () => {
  expect(content.evidence.map(e => e.id)).toEqual(seed.evidence.map(e => e.id));
  expect(content.routes.map(r => String(r.id))).toEqual(seed.routes.map(r => r.id)); expect(content.npcs.map(n => n.id)).toEqual(seed.npcs.map(n => n.id));
  for (const objective of seed.objectives) expect(content.baseDC[objective.id as keyof typeof content.baseDC]).toBe(objective.baseDC);
  expect(content.scenes.briefing.body.en).toBe(seed.readAloudPassages[0]!.text); expect(content.scenes.briefing.prompt.en).toBe(seed.readAloudPassages[1]!.text);
});
