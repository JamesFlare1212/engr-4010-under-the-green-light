import { expect, test } from 'bun:test';
import { getBrowserLocale, resolveBrowserLocale, watchBrowserLocale } from '../src/lib/browser-locale';
import type { Locale } from '../shared/types';

test('browser languages match supported English and Chinese regional variants in preference order', () => {
  expect(resolveBrowserLocale(['en-US', 'zh-CN'])).toBe('en');
  expect(resolveBrowserLocale(['zh-TW', 'en'])).toBe('zh-CN');
  expect(resolveBrowserLocale(['ZH-hans', 'en'])).toBe('zh-CN');
  expect(resolveBrowserLocale(['fr-FR', 'en-GB', 'zh-CN'])).toBe('en');
  expect(resolveBrowserLocale(['fr-FR', 'zh-HK', 'en'])).toBe('zh-CN');
  expect(resolveBrowserLocale(['fr-FR', 'ja-JP'])).toBe('en');
  expect(resolveBrowserLocale([])).toBe('en');
});

test('use navigator.language when the browser preference list is empty', () => {
  const source = Object.assign(new EventTarget(), { navigator: { languages: [], language: 'zh-CN' } });
  expect(getBrowserLocale(source)).toBe('zh-CN');
});

test('browser language changes override temporary manual selections and stop updating after cleanup', () => {
  const source = Object.assign(new EventTarget(), { navigator: { languages: ['en-US'], language: 'en-US' } });
  let current: Locale = 'zh-CN';
  let updates = 0;
  const stop = watchBrowserLocale(source, value => { current = value; updates++; });
  expect<Locale>(current).toBe('en');
  current = 'zh-CN'; // Simulate the existing manual language button.
  source.dispatchEvent(new Event('languagechange'));
  expect<Locale>(current).toBe('en');
  source.navigator.languages = ['zh-CN', 'en-US'];
  source.dispatchEvent(new Event('languagechange'));
  expect(current).toBe('zh-CN');
  stop();
  source.navigator.languages = ['en-US'];
  source.dispatchEvent(new Event('languagechange'));
  expect(current).toBe('zh-CN');
  expect(updates).toBe(3);
});
