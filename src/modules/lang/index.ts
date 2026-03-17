type Translations = Record<string, string>;

import { ref } from 'vue';

let currentLocale = 'en-US';
let currentCountry = 'US';
const dict = ref<Translations>({});
const fallback = ref<Translations>({});

import { getSetting, setSetting } from 'src/modules/storage';

async function loadJson(path: string): Promise<Translations | null> {
  try {
    // Dynamic import for JSON works with Vite
    const mod = await import(/* @vite-ignore */ path);
    return mod.default ?? mod;
  } catch (e) {
    return null;
  }
}

export async function setLocale(locale: string) {
  try {
    currentLocale = locale;
    const parts = String(locale).split(/[-_]/);
    const lang = parts[0] || 'en';
    const region = (parts[1] || (lang === 'pl' ? 'PL' : 'US')).toUpperCase();
    currentCountry = region;

    const primary = await loadJson(`./translations/${lang}-${region}.json`);
    const en = await loadJson(`./translations/en-US.json`);
    dict.value = primary || {};
    fallback.value = en || {};
  } catch (e) {
    // ignore
  }
}

export async function detectAndSetLocale(): Promise<{
  locale: string;
  lang: string;
  country: string;
}> {
  try {
    const nav: any =
      typeof navigator !== 'undefined' ? navigator : { languages: ['en-US'], language: 'en-US' };
    const raw = (nav.languages && nav.languages[0]) || nav.language || 'en-US';
    const parts = String(raw).split(/[-_]/);
    const lang = (parts[0] || 'en').toLowerCase();
    const region = (parts[1] || (lang === 'pl' ? 'PL' : 'US')).toUpperCase();
    const locale = `${lang}-${region}`;
    await setLocale(locale);
    return { locale, lang, country: region };
  } catch (e) {
    await setLocale('en-US');
    return { locale: 'en-US', lang: 'en', country: 'US' };
  }
}

export function getLanguage(): string {
  return currentLocale.split('-')[0] || 'en';
}
export function getText(key: string): string {
  if (!key) return '';
  const d = dict.value || {};
  const f = fallback.value || {};
  if (key in d) return d[key] ?? '';
  if (key in f) return f[key] ?? '';
  // simple dot->space fallback
  const part = key.split('.').slice(-1)[0] ?? '';
  return part.replace(/_/g, ' ');
}

export function $text(key: string) {
  return getText(key);
}

export async function changeLocale(locale: string) {
  try {
    await setSetting('language', locale);
  } catch (e) {
    // ignore
  }
  try {
    await setLocale(locale);
  } catch (e) {
    // ignore
  }
  return locale;
}

export async function loadSavedLocale(): Promise<string> {
  try {
    const lang = (await getSetting('language', undefined)) as string | undefined;
    if (lang) {
      await setLocale(lang);
      return lang;
    }
    const detected = await detectAndSetLocale();
    return detected.locale;
  } catch (e) {
    try {
      const detected = await detectAndSetLocale();
      return detected.locale;
    } catch (err) {
      return 'en-US';
    }
  }
}

export function getCountryCode() {
  return currentCountry;
}

export default { setLocale, getText, $text, getCountryCode };
