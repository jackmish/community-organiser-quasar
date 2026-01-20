import type { OrganiserData, DayData, Task } from './types';
import logger from 'src/utils/logger';
// Do not import Node.js path module in renderer

// Type declaration for Electron API
declare global {
  interface Window {
    electronAPI?: {
      readJsonFile: (filePath: string) => Promise<any>;
      writeJsonFile: (filePath: string, data: any) => Promise<boolean>;
      writeFile: (filePath: string, data: string) => Promise<boolean>;
      deleteFile: (filePath: string) => Promise<boolean>;
      fileExists: (filePath: string) => Promise<boolean>;
      getAppDataPath: () => Promise<string>;
      joinPath: (...paths: string[]) => string;
      ensureDir: (dirPath: string) => Promise<boolean>;
      readDir: (dirPath: string) => Promise<string[]>;
    };
  }
}

class DayOrganiserStorage {
  private storageKey = 'day-organiser-data';
  // Remove organiser-data.json logic

  /**
   * Initialize and get the full file path for data storage
   */
  private async getDataFilePath(): Promise<string> {
    // Always use the testing/storage/groups directory
    return await getGroupFilesDirectory();
  }

  /**
   * Check if we're running in Electron
   */
  private isElectron(): boolean {
    return !!window.electronAPI;
  }

  /**
   * Load data from localStorage (for web) or JSON file (for desktop/mobile)
   */
  async loadData(): Promise<OrganiserData> {
    try {
      // Load all group files from the testing/storage/groups directory
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

  /**
   * Save data to localStorage or JSON file
   */
  async saveData(data: OrganiserData): Promise<void> {
    try {
      data.lastModified = new Date().toISOString();
      // Save each group to its own file in the testing/storage/groups directory
      await saveGroupsToFiles(data.groups);
    } catch (error) {
      logger.error('Error saving organiser data to group files:', error);
      throw error;
    }
  }

  /**
   * Export data as JSON file for backup
   */
  exportToFile(data: OrganiserData): void {
    // Export all group files as a zip or similar if needed, otherwise do nothing
    logger.log('Export not implemented: all data is in testing/storage/groups');
  }

  /**
   * Import data from JSON file
   */
  async importFromFile(file: File): Promise<OrganiserData> {
    return new Promise((resolve, reject) => {
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
  }

  /**
   * Public method to get the data file path for logging/debugging
   */
  public async getDataFilePathPublic(): Promise<string> {
    if (window.electronAPI) {
      const appDataDir = await window.electronAPI.getAppDataPath();
      return appDataDir;
    }
    // For browser/dev, return empty string or a message
    return '';
  }

  /**
   * Load all group files from the group files directory
   * Returns an array of group objects
   */
  public async loadAllGroupsFromFiles(): Promise<any[]> {
    if (
      typeof window !== 'undefined' &&
      window.electronAPI &&
      typeof window.electronAPI.readJsonFile === 'function' &&
      typeof window.electronAPI.joinPath === 'function'
    ) {
      const appDataDir = await window.electronAPI.getAppDataPath();
      const groupDir = window.electronAPI.joinPath(appDataDir, 'storage', 'group');
      // Ensure the directory exists before reading
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
              console.log('Loaded group from file:', filePath);
            } catch (err) {
              // Could not read file, skip
              logger.error('Error reading group file:', filePath, err);
            }
          }
        }
      } catch (err) {
        // Could not read directory, return empty
        logger.error('Error reading group directory:', groupDir, err);
      }
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

/**
 * Utility to get group filename from groupId
 * Example: group-asmithk9x2-271125.json
 */
export function getGroupFilename(groupId: string): string {
  return `group-${groupId}.json`;
}

/**
 * Get the directory for storing group files
 * In development, use ./testing/storage/groups folder in project directory
 * In production (Electron), use app data directory
 */
export async function getGroupFilesDirectory(): Promise<string> {
  // Always use hardcoded dev path unless window.electronAPI is available
  if (window.electronAPI) {
    return await window.electronAPI.getAppDataPath();
  }
  return 'e:/Dev/laragon/www/recruitment-tasks/_Learning/MinorProjects/CommunityOrganiser/community-organiser-quasar/testing/storage/groups';
}

/**
 * Save each group to its own file in the group files directory
 */
export async function saveGroupsToFiles(groups: any[]): Promise<void> {
  if (window.electronAPI && window.electronAPI.writeFile && window.electronAPI.joinPath) {
    const appDataDir = await window.electronAPI.getAppDataPath();
    for (const group of groups) {
      // Ensure each task has groupId set
      if (Array.isArray(group.tasks)) {
        group.tasks = group.tasks.map((task: any) => ({ ...task, groupId: group.id }));
      }
      const filename = getGroupFilename(group.id);
      const groupDir = window.electronAPI.joinPath(appDataDir, 'storage', 'group');
      // Ensure the directory exists (add a method in your preload to create directories if needed)
      await window.electronAPI.ensureDir(groupDir);

      const filePath = window.electronAPI.joinPath(groupDir, filename);
      try {
        await window.electronAPI.writeFile(filePath, JSON.stringify(group));
      } catch (err) {
        logger.error('[saveGroupsToFiles] Error writing file:', filePath, err);
        throw err;
      }
    }
  } else if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem('day-organiser-groups', JSON.stringify(groups, null, 2));
  } else {
    throw new Error('No supported storage method available.');
  }
}

/**
 * Settings helper: load settings from appdata/settings.json or localStorage
 */
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

/**
 * Settings helper: save settings to appdata/settings.json or localStorage
 */
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

/**
 * Delete a group's file from disk (if running in Electron).
 */
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
        logger.log('[deleteGroupFile] removed file', filePath);
      }
    } catch (err) {
      logger.error('[deleteGroupFile] failed to delete', filePath, err);
      throw err;
    }
  } else {
    // Nothing to do for localStorage or unsupported environments
    return;
  }
}
