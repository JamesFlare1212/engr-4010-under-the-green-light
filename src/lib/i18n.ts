import { writable } from 'svelte/store';
import type { Locale, Text } from '../../shared/types';
let initial: Locale = 'zh-CN';
try { initial = localStorage.getItem('green-light:locale') === 'en' ? 'en' : 'zh-CN'; } catch { /* Private browsing may disable storage. */ }
export const locale = writable<Locale>(initial);
locale.subscribe(value => {
  document.documentElement.lang = value;
  document.title = value === 'zh-CN' ? '绿灯之下 / Under the Green Light' : 'Under the Green Light / 绿灯之下';
  try { localStorage.setItem('green-light:locale', value); } catch { /* The current session still works. */ }
});
export const translate = (text: Text, lang: Locale) => text[lang];
