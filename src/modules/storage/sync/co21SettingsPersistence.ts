import { Capacitor } from '@capacitor/core';
import logger from 'src/utils/logger';

export type Co21SettingsJson = Record<string, unknown>;

/** Mirrors on-disk `co21/settings.json` when Electron API is unavailable (Android/iOS). */
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
    const settingsDir = (api.joinPath as (a: string, b: string) => string)(appPath, 'co21');
    const settingsFile = (api.joinPath as (a: string, b: string) => string)(
      settingsDir,
      'settings.json',
    );
    const exists = await (api.fileExists as (p: string) => Promise<boolean>)(settingsFile);
    if (!exists) return {};
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
    const settingsDir = (api.joinPath as (a: string, b: string) => string)(appPath, 'co21');
    const settingsFile = (api.joinPath as (a: string, b: string) => string)(
      settingsDir,
      'settings.json',
    );
    await (api.ensureDir as (p: string) => Promise<void>)(settingsDir);
    await (api.writeJsonFile as (p: string, d: unknown) => Promise<void>)(settingsFile, payload);
    return true;
  } catch (e) {
    logger.error('[co21Settings] Electron write failed', e);
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

/** Load full `co21/settings.json` blob (Electron file, else native localStorage). */
export async function readCo21SettingsBlob(): Promise<Co21SettingsJson> {
  const fromFile = await readCo21SettingsFromElectronFile();
  if (fromFile !== null) return fromFile;
  if (Capacitor.isNativePlatform() || typeof localStorage !== 'undefined') {
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
  if (Capacitor.isNativePlatform() || typeof localStorage !== 'undefined') {
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
