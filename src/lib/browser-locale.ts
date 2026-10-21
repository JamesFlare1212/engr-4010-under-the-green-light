import type { Locale } from '../../shared/types';

export function resolveBrowserLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const base = language.toLowerCase().split(/[-_]/)[0];
    if (base === 'zh') return 'zh-CN';
    if (base === 'en') return 'en';
  }
  return 'en';
}

type LanguageSource = Pick<EventTarget, 'addEventListener' | 'removeEventListener'> & {
  readonly navigator: Pick<Navigator, 'languages' | 'language'>;
};

export function getBrowserLocale(source: LanguageSource): Locale {
  const { languages, language } = source.navigator;
  return resolveBrowserLocale(languages?.length ? languages : [language]);
}

export function watchBrowserLocale(source: LanguageSource, update: (value: Locale) => void) {
  const sync = () => update(getBrowserLocale(source));
  sync();
  source.addEventListener('languagechange', sync);
  return () => source.removeEventListener('languagechange', sync);
}
