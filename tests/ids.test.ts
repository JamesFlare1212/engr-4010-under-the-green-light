import { test, expect } from 'bun:test';
import { uuid } from '../shared/ids';
test('局域网 HTTP 没有 randomUUID 时仍生成正确且不重复的命令 ID', () => {
  const fallback = { getRandomValues: crypto.getRandomValues.bind(crypto) };
  const ids = new Set(Array.from({ length: 200 }, () => uuid(fallback)));
  expect(ids.size).toBe(200);
  for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
