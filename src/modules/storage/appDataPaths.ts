/** Canonical on-disk layout under a CO21 space data root. */

export const CO21_SQLITE_DB_FILENAME = 'co21.db';

export const CO21_CONFIG_DIR = 'co21-config';

/** @deprecated Renamed to {@link CO21_CONFIG_DIR}; kept for legacy path segments. */
export const LEGACY_CO21_DIR = 'co21';

export const CO21_DIR = CO21_CONFIG_DIR;

export const WORKSPACE_DIR = 'workspace';

/** Relative path segments (under space data root). */
export const APP_DATA_PATH_SEGMENTS = {
  workspace: ['workspace'] as const,
  legacyStorage: ['storage'] as const,
  co21Config: [CO21_CONFIG_DIR] as const,
  legacyCo21: [LEGACY_CO21_DIR] as const,
  co21SettingsFile: [CO21_CONFIG_DIR, 'settings.json'] as const,
  legacyCo21SettingsFile: [LEGACY_CO21_DIR, 'settings.json'] as const,
  co21Access: [CO21_CONFIG_DIR, 'access'] as const,
  co21Backups: [CO21_CONFIG_DIR, 'backups'] as const,
  legacyCo21Access: [LEGACY_CO21_DIR, 'access'] as const,
  group: ['workspace', 'group'] as const,
  organiserSettingsFile: ['workspace', 'settings.json'] as const,
  legacyOrganiserSettingsFile: ['storage', 'settings.json'] as const,
  attachments: ['workspace', 'attachments'] as const,
  legacyAttachmentsInStorage: ['storage', 'note-attachments'] as const,
  legacyAttachmentsInWorkspace: ['workspace', 'note-attachments'] as const,
  groupBackgrounds: ['workspace', 'group-backgrounds'] as const,
  sqlite: ['workspace', 'sqlite'] as const,
  plugins: ['workspace', 'plugins'] as const,
  pluginHolidays: ['workspace', 'plugins', 'holidays'] as const,
  pluginMeteo: ['workspace', 'plugins', 'meteo'] as const,
  legacyHolidays: ['holidays'] as const,
  legacyMeteo: ['meteo'] as const,
  cache: ['workspace', 'cache'] as const,
  mediaThumbs: ['workspace', 'cache', 'media-thumbs'] as const,
  legacyMediaThumbs: ['cache', 'media-thumbs'] as const,
} as const;

export const METEO_CACHE_FILENAME = 'meteo_cache.json';

export function holidaysCacheFileName(
  countryCode: string,
  displayLang: string,
  year: number,
): string {
  return `holidays_${countryCode}_${displayLang}_${year}.json`;
}

export function legacyHolidaysCacheFileName(countryCode: string, year: number): string {
  return `holidays_${countryCode}_${year}.json`;
}

export function joinPathSegments(
  joinPath: (...parts: string[]) => string,
  root: string,
  segments: readonly string[],
  ...extra: string[]
): string {
  return joinPath(root, ...segments, ...extra);
}

export function sqliteDbPathSegments(): readonly string[] {
  return [...APP_DATA_PATH_SEGMENTS.sqlite, CO21_SQLITE_DB_FILENAME];
}

export function legacySqliteDbPathSegments(): readonly string[] {
  return [CO21_SQLITE_DB_FILENAME];
}
