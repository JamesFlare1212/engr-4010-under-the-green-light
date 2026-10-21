import { test, expect } from 'bun:test';
import { uuid } from '../shared/ids';
test('LAN HTTP generates valid unique command IDs when randomUUID is unavailable', () => {
  const fallback = { getRandomValues: crypto.getRandomValues.bind(crypto) };
  const ids = new Set(Array.from({ length: 200 }, () => uuid(fallback)));
  expect(ids.size).toBe(200);
  for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
