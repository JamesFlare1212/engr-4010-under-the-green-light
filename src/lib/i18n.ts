import { writable } from 'svelte/store';
import type { Locale, Text } from '../../shared/types';
import { getBrowserLocale, watchBrowserLocale } from './browser-locale';

export const locale = writable<Locale>(getBrowserLocale(window));
locale.subscribe(value => {
  document.documentElement.lang = value;
  document.title = value === 'zh-CN' ? '绿灯之下 / Under the Green Light' : 'Under the Green Light / 绿灯之下';
});
// Manual switching lasts until the browser language changes or the page reloads.
export const syncBrowserLocale = () => watchBrowserLocale(window, locale.set);
export const translate = (text: Text, lang: Locale) => text[lang];
