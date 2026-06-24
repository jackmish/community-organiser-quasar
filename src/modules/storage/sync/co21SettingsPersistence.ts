import { Capacitor } from '@capacitor/core';
import logger from 'src/utils/logger';
import {
  APP_DATA_PATH_SEGMENTS,
  joinPathSegments,
} from 'src/modules/storage/appDataPaths';
import {
  readCapacitorJsonFile,
  writeCapacitorJsonFile,
} from 'src/modules/storage/backend/mobile/capacitorAppDataFiles';
import {
  readNativeCo21SettingsFromPreferences,
  writeNativeCo21SettingsToPreferences,
} from 'src/modules/storage/backend/mobile/capacitorNativePreferences';

export type Co21SettingsJson = Record<string, unknown>;

/** Mirrors on-disk `co21-config/settings.json` when Electron API is unavailable (Android/iOS). */
const CO21_SETTINGS_PATH = APP_DATA_PATH_SEGMENTS.co21SettingsFile.join('/');
const CO21_SETTINGS_LOCAL_KEY = 'co21-settings.json';

function electronApi(): Record<string, unknown> | null {
  const api = (window as unknown as { electronAPI?: Record<string, unknown> }).electronAPI;
  if (!api || typeof api.getAppDataPath !== 'function') return null;
  return api;
}

async function readCo21SettingsFromElectronFile(): Promise<Co21SettingsJson | null> {
  const api = electronApi();
  if (!api) return null;
  try {
    if (
      typeof api.getStorageContext === 'function' &&
      typeof api.loadCo21SettingsSqlite === 'function'
    ) {
      const ctx = await (api.getStorageContext as () => Promise<{
        storageMode: string;
        sqliteReady: boolean;
      }>)();
      if (ctx.storageMode === 'sqlite' && ctx.sqliteReady) {
        const data = await (api.loadCo21SettingsSqlite as () => Promise<unknown>)();
        return data && typeof data === 'object' ? (data as Co21SettingsJson) : {};
      }
    }
    const appPath = await (api.getAppDataPath as () => Promise<string>)();
    const joinPath = api.joinPath as (...parts: string[]) => string;
    const settingsFile = joinPathSegments(joinPath, appPath, APP_DATA_PATH_SEGMENTS.co21SettingsFile);
    let exists = await (api.fileExists as (p: string) => Promise<boolean>)(settingsFile);
    if (!exists) {
      const legacyFile = joinPathSegments(
        joinPath,
        appPath,
        APP_DATA_PATH_SEGMENTS.legacyCo21SettingsFile,
      );
      exists = await (api.fileExists as (p: string) => Promise<boolean>)(legacyFile);
      if (!exists) return {};
      const data = await (api.readJsonFile as (p: string) => Promise<unknown>)(legacyFile);
      return data && typeof data === 'object' ? (data as Co21SettingsJson) : {};
    }
    const data = await (api.readJsonFile as (p: string) => Promise<unknown>)(settingsFile);
    return data && typeof data === 'object' ? (data as Co21SettingsJson) : {};
  } catch (e) {
    logger.warn('[co21Settings] Electron read failed', e);
    return null;
  }
}

async function writeCo21SettingsToElectronFile(payload: Co21SettingsJson): Promise<boolean> {
  const api = electronApi();
  if (!api) return false;
  try {
    if (
      typeof api.getStorageContext === 'function' &&
      typeof api.saveCo21SettingsSqlite === 'function'
    ) {
      const ctx = await (api.getStorageContext as () => Promise<{
        storageMode: string;
        sqliteReady: boolean;
      }>)();
      if (ctx.storageMode === 'sqlite' && ctx.sqliteReady) {
        await (api.saveCo21SettingsSqlite as (d: Co21SettingsJson) => Promise<unknown>)(payload);
        return true;
      }
    }
    const appPath = await (api.getAppDataPath as () => Promise<string>)();
    const joinPath = api.joinPath as (...parts: string[]) => string;
    const settingsDir = joinPathSegments(joinPath, appPath, APP_DATA_PATH_SEGMENTS.co21Config);
    const settingsFile = joinPathSegments(joinPath, appPath, APP_DATA_PATH_SEGMENTS.co21SettingsFile);
    await (api.ensureDir as (p: string) => Promise<void>)(settingsDir);
    await (api.writeJsonFile as (p: string, d: unknown) => Promise<void>)(settingsFile, payload);
    return true;
  } catch (e) {
    logger.error('[co21Settings] Electron write failed', e);
    return false;
  }
}

async function readCo21SettingsFromCapacitorFile(): Promise<Co21SettingsJson | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const fromPrefs = await readNativeCo21SettingsFromPreferences();
    if (Object.keys(fromPrefs).length > 0) return fromPrefs;

    const data = await readCapacitorJsonFile(CO21_SETTINGS_PATH);
    if (data === null) return {};
    return data && typeof data === 'object' ? (data as Co21SettingsJson) : {};
  } catch (e) {
    logger.warn('[co21Settings] Capacitor read failed', e);
    return null;
  }
}

async function writeCo21SettingsToCapacitorFile(payload: Co21SettingsJson): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    await writeNativeCo21SettingsToPreferences(payload);
    try {
      await writeCapacitorJsonFile(CO21_SETTINGS_PATH, payload);
    } catch (fileErr) {
      logger.warn('[co21Settings] file write failed (Preferences saved)', fileErr);
    }
    return true;
  } catch (e) {
    logger.error('[co21Settings] Capacitor write failed', e);
    return false;
  }
}

function readCo21SettingsFromLocalStorage(): Co21SettingsJson {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CO21_SETTINGS_LOCAL_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Co21SettingsJson) : {};
  } catch (e) {
    logger.warn('[co21Settings] localStorage read failed', e);
    return {};
  }
}

function writeCo21SettingsToLocalStorage(payload: Co21SettingsJson): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    localStorage.setItem(CO21_SETTINGS_LOCAL_KEY, JSON.stringify(payload));
    return true;
  } catch (e) {
    logger.error('[co21Settings] localStorage write failed', e);
    return false;
  }
}

/** Load full `co21/settings.json` blob (Electron file, else Capacitor file, else localStorage on web). */
export async function readCo21SettingsBlob(): Promise<Co21SettingsJson> {
  const fromFile = await readCo21SettingsFromElectronFile();
  if (fromFile !== null) return fromFile;
  if (Capacitor.isNativePlatform()) {
    const fromCapacitor = await readCo21SettingsFromCapacitorFile();
    return fromCapacitor ?? {};
  }
  if (typeof localStorage !== 'undefined') {
    return readCo21SettingsFromLocalStorage();
  }
  return {};
}

/**
 * Serialize all settings writes so concurrent patches (e.g. roleProfiles + devices)
 * cannot overwrite each other with a stale read — that was wiping Connections on PC.
 */
let settingsWriteQueue: Promise<boolean> = Promise.resolve(true);

function enqueueCo21SettingsWrite(task: () => Promise<boolean>): Promise<boolean> {
  const run = settingsWriteQueue.then(task, task);
  settingsWriteQueue = run.catch(() => false);
  return run;
}

async function persistCo21SettingsPayload(payload: Co21SettingsJson): Promise<boolean> {
  const wroteFile = await writeCo21SettingsToElectronFile(payload);
  if (electronApi()) {
    return wroteFile;
  }
  if (Capacitor.isNativePlatform()) {
    return writeCo21SettingsToCapacitorFile(payload);
  }
  if (typeof localStorage !== 'undefined') {
    return writeCo21SettingsToLocalStorage(payload);
  }
  return false;
}

const GENERIC_OWN_DEVICE_NAMES = new Set([
  'this device',
  'this pc',
  'device',
  'lan device',
  'unknown',
  'localhost',
]);

function mergeCo21SettingsPatch(existing: Co21SettingsJson, patch: Co21SettingsJson): Co21SettingsJson {
  const payload = JSON.parse(JSON.stringify({ ...existing, ...patch })) as Co21SettingsJson;

  if ('ownDeviceName' in patch) {
    const next =
      typeof patch.ownDeviceName === 'string' ? patch.ownDeviceName.trim() : '';
    const prev =
      typeof existing.ownDeviceName === 'string' ? existing.ownDeviceName.trim() : '';
    const nextGeneric = !next || GENERIC_OWN_DEVICE_NAMES.has(next.toLowerCase());
    const prevGeneric = !prev || GENERIC_OWN_DEVICE_NAMES.has(prev.toLowerCase());

    if (!next && prev) {
      payload.ownDeviceName = existing.ownDeviceName;
    } else if (nextGeneric && prev && !prevGeneric) {
      payload.ownDeviceName = existing.ownDeviceName;
    }
  }

  return payload;
}

/** Merge patch into settings blob and persist (never drops unrelated keys). */
export async function writeCo21SettingsBlob(patch: Co21SettingsJson): Promise<boolean> {
  return enqueueCo21SettingsWrite(async () => {
    const existing = await readCo21SettingsBlob();
    const payload = mergeCo21SettingsPatch(existing, patch);
    return persistCo21SettingsPayload(payload);
  });
}
