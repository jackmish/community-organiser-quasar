type Translations = Record<string, string>;

let currentLocale = 'en-US';
let currentCountry = 'US';
let dict: Translations = {};
let fallback: Translations = {};

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
    dict = primary || {};
    fallback = en || {};
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
  if (dict && key in dict) return dict[key] ?? '';
  if (fallback && key in fallback) return fallback[key] ?? '';
  // simple dot->space fallback
  const part = key.split('.').slice(-1)[0] ?? '';
  return part.replace(/_/g, ' ');
}

export function $text(key: string) {
  return getText(key);
}

export function getCountryCode() {
  return currentCountry;
}

export default { setLocale, getText, $text, getCountryCode };
