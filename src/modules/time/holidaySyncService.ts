import logger from 'src/utils/logger';
import {
  detectAndSetLocale,
  getCountryCode,
  getLanguage,
  loadSavedLocale,
} from 'src/modules/lang';
import { loadHolidaySyncEnabled } from './holidaySyncSettings';

export interface Holiday {
  date: string;
  localName: string;
  name: string;
}

interface HolidayCache {
  year: number;
  holidays: Holiday[];
  fetchedAt: number;
}

export type HolidaysMap = Map<string, Holiday>;

const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

export const NAGER_HOLIDAYS_API = 'https://date.nager.at/api/v3/PublicHolidays';

async function getHolidaysFilePath(
  year: number,
  countryCode: string,
  displayLang: string,
): Promise<string | null> {
  if (!isElectron) return null;

  const appDataPath = await (window as any).electronAPI.getAppDataPath();
  return (window as any).electronAPI.joinPath(
    appDataPath,
    'holidays',
    `holidays_${countryCode}_${displayLang}_${year}.json`,
  );
}

async function loadHolidaysFromCache(
  year: number,
  countryCode: string,
  displayLang: string,
  holidays: HolidaysMap,
): Promise<boolean> {
  try {
    if (isElectron) {
      const filePath = await getHolidaysFilePath(year, countryCode, displayLang);
      if (!filePath) return false;

      let exists = await (window as any).electronAPI.fileExists(filePath);
      let data: HolidayCache | null = null;

      if (exists) {
        data = await (window as any).electronAPI.readJsonFile(filePath);
      } else {
        const appDataPath = await (window as any).electronAPI.getAppDataPath();
        const legacyPath = (window as any).electronAPI.joinPath(
          appDataPath,
          'holidays',
          `holidays_${countryCode}_${year}.json`,
        );
        const legacyExists = await (window as any).electronAPI.fileExists(legacyPath);
        if (legacyExists) {
          try {
            data = await (window as any).electronAPI.readJsonFile(legacyPath);
            const safe = JSON.parse(JSON.stringify(data));
            await (window as any).electronAPI.ensureDir(
              (window as any).electronAPI.joinPath(appDataPath, 'holidays'),
            );
            await (window as any).electronAPI.writeJsonFile(filePath, safe);
            exists = true;
          } catch {
            // ignore and treat as not found
          }
        }
      }

      if (!data) return false;

      data.holidays.forEach((holiday) => {
        holidays.set(holiday.date, holiday);
      });

      return true;
    }

    const langKey = `holidays_${countryCode}_${displayLang}_${year}`;
    const legacyKey = `holidays_${countryCode}_${year}`;
    let cached = localStorage.getItem(langKey);
    let usedLegacy = false;
    if (!cached) {
      cached = localStorage.getItem(legacyKey);
      usedLegacy = !!cached;
    }

    if (!cached) return false;

    const data: HolidayCache = JSON.parse(cached);

    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const isExpired = Date.now() - data.fetchedAt > thirtyDaysMs;

    if (isExpired) {
      try {
        if (usedLegacy) localStorage.removeItem(legacyKey);
        else localStorage.removeItem(langKey);
      } catch {
        // ignore
      }
      return false;
    }

    data.holidays.forEach((holiday) => {
      holidays.set(holiday.date, holiday);
    });

    if (usedLegacy) {
      try {
        localStorage.setItem(langKey, JSON.stringify(data));
        localStorage.removeItem(legacyKey);
      } catch {
        // ignore storage errors
      }
    }

    return true;
  } catch (error) {
    logger.error('Failed to load holidays from cache:', error);
    return false;
  }
}

async function saveHolidaysToCache(
  year: number,
  countryCode: string,
  displayLang: string,
  holidayList: Holiday[],
): Promise<void> {
  try {
    const cache: HolidayCache = {
      year,
      holidays: holidayList,
      fetchedAt: Date.now(),
    };

    if (isElectron) {
      const filePath = await getHolidaysFilePath(year, countryCode, displayLang);
      if (!filePath) return;

      const dirPath = (window as any).electronAPI.joinPath(
        await (window as any).electronAPI.getAppDataPath(),
        'holidays',
      );
      await (window as any).electronAPI.ensureDir(dirPath);

      const safe = JSON.parse(JSON.stringify(cache));
      await (window as any).electronAPI.writeJsonFile(filePath, safe);
    } else {
      const cacheKey = `holidays_${countryCode}_${displayLang}_${year}`;
      localStorage.setItem(cacheKey, JSON.stringify(cache));
    }
  } catch (error) {
    logger.error('Failed to save holidays to cache:', error);
  }
}

export async function fetchHolidaysForYear(
  year: number,
  countryCode: string,
  displayLang: string,
  holidays: HolidaysMap,
): Promise<void> {
  const loaded = await loadHolidaysFromCache(year, countryCode, displayLang, holidays);
  if (loaded) return;

  try {
    const data: Holiday[] = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.timeout = 5000;
      xhr.open('GET', `${NAGER_HOLIDAYS_API}/${year}/${countryCode}`);
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error('Failed to parse JSON'));
          }
        } else {
          reject(new Error(`HTTP error! status: ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.ontimeout = () => reject(new Error('Request timeout'));
      xhr.send();
    });

    data.forEach((holiday) => {
      holidays.set(holiday.date, holiday);
    });

    await saveHolidaysToCache(year, countryCode, displayLang, data);
  } catch (error) {
    logger.warn(
      `Failed to fetch holidays for ${year}. Its not important, but if you need holidays probably there is firewall or network issue:`,
      error,
    );
  }
}

export async function resolveHolidayLocale(): Promise<{ country: string; lang: string }> {
  try {
    await loadSavedLocale();
    return {
      country: getCountryCode(),
      lang: getLanguage(),
    };
  } catch {
    try {
      const info = await detectAndSetLocale();
      return {
        country: info.country,
        lang: info.lang,
      };
    } catch {
      return { country: 'PL', lang: 'en' };
    }
  }
}

export async function refreshHolidayData(
  holidays: HolidaysMap,
  countryCode: string,
  displayLang: string,
): Promise<void> {
  const enabled = await loadHolidaySyncEnabled();
  if (!enabled) {
    holidays.clear();
    return;
  }

  const currentYear = new Date().getFullYear();
  await fetchHolidaysForYear(currentYear, countryCode, displayLang, holidays);
  await fetchHolidaysForYear(currentYear + 1, countryCode, displayLang, holidays);
}
