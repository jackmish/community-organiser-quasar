import type { OrganiserData } from '../day-organiser/types';
import logger from '../../utils/logger';
import type { ElectronAPI } from './types';

declare global {
  // Augment Window so existing code that uses `window.electronAPI` keeps working.
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

class DayOrganiserStorage {
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
    if (
      typeof window !== 'undefined' &&
      window.electronAPI &&
      typeof window.electronAPI.readJsonFile === 'function' &&
      typeof window.electronAPI.joinPath === 'function'
    ) {
      const appDataDir = await window.electronAPI.getAppDataPath();
      const groupDir = window.electronAPI.joinPath(appDataDir, 'storage', 'group');
      await window.electronAPI.ensureDir(groupDir);
      const groups: any[] = [];
      try {
        const files = await window.electronAPI.readDir(groupDir);

        for (const file of files) {
          if (file.startsWith('group-') && file.endsWith('.json')) {
            const filePath = window.electronAPI.joinPath(groupDir, file);
            try {
              const groupData = await window.electronAPI.readJsonFile(filePath);
              groups.push(groupData);
            } catch (err) {
              logger.error('Error reading group file:', filePath, err);
            }
          }
        }
      } catch (err) {
        logger.error('Error reading group directory:', groupDir, err);
      }
      // loaded groups from files
      return groups;
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

export function getGroupFilename(groupId: string): string {
  return `group-${groupId}.json`;
}

export async function getGroupFilesDirectory(): Promise<string> {
  if (window.electronAPI) {
    return await window.electronAPI.getAppDataPath();
  }
  return '';
}

export async function saveGroupsToFiles(groups: any[]): Promise<void> {
  if (window.electronAPI && window.electronAPI.writeFile && window.electronAPI.joinPath) {
    const appDataDir = await window.electronAPI.getAppDataPath();
    for (const group of groups) {
      // Do not mutate the original group object (may contain circular refs).
      const safeTasks = Array.isArray(group.tasks)
        ? group.tasks.map((task: any) => {
            // copy primitive and plain properties only
            const t = Object.assign({}, task);
            t.groupId = group.id;
            // remove internal back-references that commonly cause circular refs
            if (t._group) delete t._group;
            return t;
          })
        : undefined;
      const groupToWrite: any = Object.assign({}, group);
      if (safeTasks !== undefined) groupToWrite.tasks = safeTasks;
      const filename = getGroupFilename(group.id);
      const groupDir = window.electronAPI.joinPath(appDataDir, 'storage', 'group');
      await window.electronAPI.ensureDir(groupDir);

      const filePath = window.electronAPI.joinPath(groupDir, filename);
      try {
        // Safe stringify to avoid circular references (skip properties starting with underscore and functions)
        const seen = new WeakSet();
        const text = JSON.stringify(
          groupToWrite,
          function (k: string, v: any) {
            if (typeof v === 'object' && v !== null) {
              if (seen.has(v)) return undefined;
              seen.add(v);
            }
            if (typeof v === 'function') return undefined;
            if (k && k.startsWith('_')) return undefined;
            return v;
          },
          2,
        );
        await window.electronAPI.writeFile(filePath, text);
      } catch (err) {
        logger.error('[saveGroupsToFiles] Error writing file:', filePath, err);
        throw err;
      }
    }
  } else if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const seen = new WeakSet();
      const text = JSON.stringify(
        groups,
        function (k: string, v: any) {
          if (typeof v === 'object' && v !== null) {
            if (seen.has(v)) return undefined;
            seen.add(v);
          }
          if (typeof v === 'function') return undefined;
          if (k && k.startsWith('_')) return undefined;
          return v;
        },
        2,
      );
      localStorage.setItem('day-organiser-groups', text);
    } catch (e) {
      // ignore storage errors
    }
  } else {
    throw new Error('No supported storage method available.');
  }
}

export async function loadSettings(): Promise<any> {
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
      // ignore
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
