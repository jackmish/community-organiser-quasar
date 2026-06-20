import logger from '../../../../utils/logger';
import type { ElectronAppdataAPI } from './ElectronAppdataAPI';
import { isActiveSpaceSqliteStorage } from './ElectronAppdataAPI';
import { loadGroupsFromGroupDirectory, getGroupFilename } from './groupFileLoader';
import type { StorageBackend } from '../StorageBackend';
import { shouldUseCapacitorStorage } from '../storagePlatform';
import { capacitorStorage } from '../mobile/capacitorBackend';
import { sanitizeGroupsForStorage } from '../groupStorageSanitize';
// Re-export so existing callers that import OrganiserData from this module keep working.
export type { OrganiserData } from '../StorageBackend';
import type { OrganiserData } from '../StorageBackend';

declare global {
  // Augment Window so existing code that uses `window.electronAPI` keeps working.
  interface Window {
    electronAPI?: ElectronAppdataAPI;
  }
}

class DayOrganiserStorage implements StorageBackend {
  readonly name = 'electron';

  isAvailable(): boolean {
    return (
      (typeof window !== 'undefined' && !!window.electronAPI) ||
      (typeof window !== 'undefined' && !!window.localStorage)
    );
  }

  // ── StorageBackend: groups ────────────────────────────────────────────────

  async loadAllGroups() {
    return this.loadAllGroupsFromFiles();
  }

  async saveGroups(groups: any[]) {
    return saveGroupsToFiles(groups);
  }

  async deleteGroup(groupId: string) {
    return deleteGroupFile(groupId);
  }

  // ── StorageBackend: settings ──────────────────────────────────────────────

  async loadSettings(): Promise<Record<string, any>> {
    return loadSettings();
  }

  async saveSettings(settings: Record<string, any>): Promise<void> {
    return saveSettings(settings);
  }

  async getSetting(key: string, defaultValue: any = undefined): Promise<any> {
    return getSetting(key, defaultValue);
  }

  async setSetting(key: string, value: any): Promise<void> {
    return setSetting(key, value);
  }

  // ── StorageBackend: diagnostics ───────────────────────────────────────────

  async getStoragePath(): Promise<string> {
    return this.getDataFilePathPublic();
  }

  // ── Legacy / internal ─────────────────────────────────────────────────────

  async loadData(): Promise<OrganiserData> {
    try {
      const groups = await this.loadAllGroupsFromFiles();
      return {
        days: {},
        groups,
        lastModified: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Error loading organiser data from group files:', error);
      return this.getDefaultData();
    }
  }

  async saveData(data: OrganiserData): Promise<void> {
    try {
      data.lastModified = new Date().toISOString();
      await saveGroupsToFiles(data.groups);
    } catch (error) {
      logger.error('Error saving organiser data to group files:', error);
      throw error;
    }
  }

  exportToFile(data: OrganiserData): void {}

  async importFromFile(file: File): Promise<OrganiserData> {
    // Support importing either plain JSON files or zip archives containing a JSON payload.
    try {
      const name = String(file.name || '').toLowerCase();
      if (name.endsWith('.zip')) {
        // Use `fflate` for client-side zip extraction (works in renderer and browser).
        // Dynamically import so bundlers can tree-shake when not used.
        const mod: any = await import('fflate');
        const arrayBuffer = await file.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        // unzipSync returns a map of filename -> Uint8Array
        const files = mod.unzipSync(uint8);
        if (!files || typeof files !== 'object') throw new Error('Invalid zip content');
        // prefer an internal json filename matching the zip name, else first .json
        const expectedJson = name.replace(/\.zip$/, '.json');
        let jsonEntry: string | null = null;
        // Helper: get basename of zip entry
        const basename = (p: string) => {
          const parts = p.split('/');
          return parts[parts.length - 1];
        };

        // Try exact match first
        if (Object.prototype.hasOwnProperty.call(files, expectedJson)) jsonEntry = expectedJson;
        // Try basename match (e.g. folder/backup.json)
        if (!jsonEntry) {
          for (const k of Object.keys(files)) {
            const b = String(basename(k)).toLowerCase();
            if (b === expectedJson) {
              jsonEntry = k;
              break;
            }
          }
        }
        // Try common filenames or any .json entry
        if (!jsonEntry) {
          const common = ['backup.json', 'data.json', 'connections.json', 'export.json'];
          for (const k of Object.keys(files)) {
            const b = String(basename(k)).toLowerCase();
            if (common.includes(b)) {
              jsonEntry = k;
              break;
            }
          }
        }
        if (!jsonEntry) {
          for (const k of Object.keys(files)) {
            if (String(k).toLowerCase().endsWith('.json')) {
              jsonEntry = k;
              break;
            }
          }
        }
        if (!jsonEntry) throw new Error('No JSON file found inside zip');
        const u8 = files[jsonEntry];
        if (!u8) throw new Error('Zip entry is empty');
        const text = new TextDecoder().decode(u8);
        try {
          return JSON.parse(text) as OrganiserData;
        } catch (e) {
          throw new Error('Invalid JSON inside zip');
        }
      }

      // Fallback: plain JSON file
      return await new Promise<OrganiserData>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target?.result as string);
            resolve(data);
          } catch (error) {
            reject(new Error('Invalid JSON file'));
          }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
      });
    } catch (err) {
      logger.error('importFromFile failed', err);
      throw err;
    }
  }

  public async getDataFilePathPublic(): Promise<string> {
    if (window.electronAPI) {
      const appDataDir = await window.electronAPI.getAppDataPath();
      return appDataDir;
    }
    return '';
  }

  public async loadAllGroupsFromFiles(): Promise<any[]> {
    if (shouldUseCapacitorStorage()) {
      return capacitorStorage.loadAllGroups();
    }
    if (
      typeof window !== 'undefined' &&
      window.electronAPI &&
      (await isActiveSpaceSqliteStorage()) &&
      typeof window.electronAPI.loadGroupsSqlite === 'function'
    ) {
      try {
        return await window.electronAPI.loadGroupsSqlite();
      } catch (err) {
        logger.error('Error reading groups from SQLite:', err);
        return [];
      }
    }
    if (
      typeof window !== 'undefined' &&
      window.electronAPI &&
      typeof window.electronAPI.readJsonFile === 'function' &&
      typeof window.electronAPI.joinPath === 'function'
    ) {
      try {
        return await loadGroupsFromGroupDirectory(window.electronAPI);
      } catch (err) {
        logger.error('Error reading group directory:', err);
        return [];
      }
    } else if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem('day-organiser-groups');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return [];
        }
      }
      return [];
    } else {
      throw new Error('No supported storage method available.');
    }
  }

  private getDefaultData(): OrganiserData {
    return {
      days: {},
      groups: [],
      lastModified: new Date().toISOString(),
    };
  }
}

export const storage = new DayOrganiserStorage();

export { getGroupFilename } from './groupFileLoader';

export async function getGroupFilesDirectory(): Promise<string> {
  if (window.electronAPI) {
    return await window.electronAPI.getAppDataPath();
  }
  return '';
}

export async function saveGroupsToFiles(groups: any[]): Promise<void> {
  if (shouldUseCapacitorStorage()) {
    await capacitorStorage.saveGroups(groups);
    return;
  }

  const sanitizedGroups = await sanitizeGroupsForStorage(groups);

  if (
    window.electronAPI &&
    (await isActiveSpaceSqliteStorage()) &&
    typeof window.electronAPI.saveGroupsSqlite === 'function'
  ) {
    await window.electronAPI.saveGroupsSqlite(sanitizedGroups);
    return;
  }
  if (window.electronAPI && window.electronAPI.writeFile && window.electronAPI.joinPath) {
    const appDataDir = await window.electronAPI.getAppDataPath();
    for (const groupToWrite of sanitizedGroups) {
      const groupId = typeof groupToWrite.id === 'string' ? groupToWrite.id : '';
      if (!groupId) continue;
      const filename = getGroupFilename(groupId);
      const groupDir = window.electronAPI.joinPath(appDataDir, 'storage', 'group');
      await window.electronAPI.ensureDir(groupDir);

      const filePath = window.electronAPI.joinPath(groupDir, filename);
      try {
        const text = JSON.stringify(groupToWrite, null, 2);
        await window.electronAPI.writeFile(filePath, text);
      } catch (err) {
        logger.error('[saveGroupsToFiles] Error writing file:', filePath, err);
        throw err;
      }
    }
  } else if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem('day-organiser-groups', JSON.stringify(sanitizedGroups, null, 2));
    } catch (e) {
      logger.error('[saveGroupsToFiles] localStorage save failed', e);
      throw e;
    }
  } else {
    throw new Error('No supported storage method available.');
  }
}

export async function loadSettings(): Promise<any> {
  if (shouldUseCapacitorStorage()) {
    return capacitorStorage.loadSettings();
  }
  if (
    window.electronAPI &&
    (await isActiveSpaceSqliteStorage()) &&
    typeof window.electronAPI.loadSettingsSqlite === 'function'
  ) {
    try {
      return (await window.electronAPI.loadSettingsSqlite()) || {};
    } catch (err) {
      logger.error('[loadSettings] sqlite failed', err);
      return {};
    }
  }
  if (
    window.electronAPI &&
    window.electronAPI.getAppDataPath &&
    window.electronAPI.joinPath &&
    window.electronAPI.readJsonFile
  ) {
    const appDataDir = await window.electronAPI.getAppDataPath();
    const settingsDir = window.electronAPI.joinPath(appDataDir, 'storage');
    try {
      await window.electronAPI.ensureDir(settingsDir);
    } catch (e) {
      void e;
    }
    const settingsPath = window.electronAPI.joinPath(settingsDir, 'settings.json');
    try {
      const exists = await window.electronAPI.fileExists(settingsPath);
      if (!exists) return {};
      const data = await window.electronAPI.readJsonFile(settingsPath);
      return data || {};
    } catch (err) {
      logger.error('[loadSettings] failed', err);
      return {};
    }
  } else if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const s = localStorage.getItem('day-organiser-settings');
      return s ? JSON.parse(s) : {};
    } catch (e) {
      return {};
    }
  }
  return {};
}

export async function saveSettings(settings: any): Promise<void> {
  if (shouldUseCapacitorStorage()) {
    await capacitorStorage.saveSettings(settings || {});
    return;
  }
  if (
    window.electronAPI &&
    (await isActiveSpaceSqliteStorage()) &&
    typeof window.electronAPI.saveSettingsSqlite === 'function'
  ) {
    await window.electronAPI.saveSettingsSqlite(settings || {});
    return;
  }
  if (
    window.electronAPI &&
    window.electronAPI.getAppDataPath &&
    window.electronAPI.joinPath &&
    window.electronAPI.writeJsonFile
  ) {
    const appDataDir = await window.electronAPI.getAppDataPath();
    const settingsDir = window.electronAPI.joinPath(appDataDir, 'storage');
    try {
      await window.electronAPI.ensureDir(settingsDir);
    } catch (e) {
      void e;
    }
    const settingsPath = window.electronAPI.joinPath(settingsDir, 'settings.json');
    try {
      await window.electronAPI.writeJsonFile(settingsPath, settings);
    } catch (err) {
      logger.error('[saveSettings] failed', err);
      throw err;
    }
  } else if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem('day-organiser-settings', JSON.stringify(settings));
    } catch (e) {
      logger.error('[saveSettings] localStorage save failed', e);
      throw e;
    }
  }
}

// Higher-level aliases to make intent clear for callers
export async function getSettings(): Promise<any> {
  return await loadSettings();
}

export async function setSettings(settings: any): Promise<void> {
  return await saveSettings(settings);
}

export async function getSetting(key: string, defaultValue: any = undefined): Promise<any> {
  try {
    const s = await loadSettings();
    if (s && Object.prototype.hasOwnProperty.call(s, key)) return s[key];
    return defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

export async function setSetting(key: string, value: any): Promise<void> {
  try {
    const s = (await loadSettings()) || {};
    s[key] = value;
    await saveSettings(s);
  } catch (e) {
    // ignore errors
  }
}

export async function deleteGroupFile(groupId: string): Promise<void> {
  if (shouldUseCapacitorStorage()) {
    await capacitorStorage.deleteGroup(groupId);
    return;
  }
  if (
    window.electronAPI &&
    (await isActiveSpaceSqliteStorage()) &&
    typeof window.electronAPI.deleteGroupSqlite === 'function'
  ) {
    await window.electronAPI.deleteGroupSqlite(groupId);
    return;
  }
  if (window.electronAPI && window.electronAPI.joinPath && window.electronAPI.deleteFile) {
    const appDataDir = await window.electronAPI.getAppDataPath();
    const groupDir = window.electronAPI.joinPath(appDataDir, 'storage', 'group');
    const filename = getGroupFilename(groupId);
    const filePath = window.electronAPI.joinPath(groupDir, filename);
    try {
      const exists = await window.electronAPI.fileExists(filePath);
      if (exists) {
        await window.electronAPI.deleteFile(filePath);
      }
    } catch (err) {
      logger.error('[deleteGroupFile] failed to delete', filePath, err);
      throw err;
    }
  } else {
    return;
  }
}
