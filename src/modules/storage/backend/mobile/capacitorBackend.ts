/**
 * CapacitorBackend — persistence for Android / iOS (app sandbox files).
 */

import type { StorageBackend, OrganiserData } from '../StorageBackend';
import type { Group } from '../../../group/models/GroupModel';
import logger from '../../../../utils/logger';
import { sanitizeGroupsForStorage } from '../groupStorageSanitize';
import {
  getGroupFilename,
  isGroupJsonFilename,
  normalizeGroupFromDisk,
  parseGroupJsonText,
} from '../electron/groupFileLoader';
import {
  deleteCapacitorDataFile,
  ensureCapacitorDataDir,
  getCapacitorDataUri,
  listCapacitorDirNames,
  readCapacitorJsonFile,
  readCapacitorTextFile,
  writeCapacitorJsonFile,
  writeCapacitorTextFile,
} from './capacitorAppDataFiles';
import {
  readNativeGroupsFromPreferences,
  writeNativeGroupsToPreferences,
  readNativeOrganiserSettingsFromPreferences,
  writeNativeOrganiserSettingsToPreferences,
} from './capacitorNativePreferences';

import { APP_DATA_PATH_SEGMENTS } from '../../appDataPaths';

const GROUP_SUBDIR = APP_DATA_PATH_SEGMENTS.group.join('/');
const SETTINGS_PATH = APP_DATA_PATH_SEGMENTS.organiserSettingsFile.join('/');

export class CapacitorBackend implements StorageBackend {
  readonly name = 'capacitor';

  isAvailable(): boolean {
    return true;
  }

  async loadAllGroups(): Promise<Group[]> {
    try {
      await ensureCapacitorDataDir(GROUP_SUBDIR);
      const files = await listCapacitorDirNames(GROUP_SUBDIR);
      const groups: Group[] = [];
      for (const filename of files) {
        if (!isGroupJsonFilename(filename)) continue;
        const path = `${GROUP_SUBDIR}/${filename}`;
        try {
          const text = await readCapacitorTextFile(path);
          const parsed = parseGroupJsonText(text ?? '');
          const row = normalizeGroupFromDisk(parsed, filename);
          if (row) groups.push(row as unknown as Group);
        } catch (err) {
          logger.error('[CapacitorBackend] read group failed', path, err);
        }
      }
      if (groups.length) {
        logger.info('[CapacitorBackend] loaded groups from files', groups.length);
        return groups;
      }

      const fromPrefs = await readNativeGroupsFromPreferences();
      if (fromPrefs.length) {
        logger.info('[CapacitorBackend] loaded groups from Preferences', fromPrefs.length);
        return fromPrefs as unknown as Group[];
      }

      logger.debug('[CapacitorBackend] no groups on disk or Preferences');
      return [];
    } catch (err) {
      logger.error('[CapacitorBackend] loadAllGroups failed', err);
      const fromPrefs = await readNativeGroupsFromPreferences();
      return fromPrefs as unknown as Group[];
    }
  }

  async saveGroups(groups: Group[]): Promise<void> {
    const sanitizedGroups = await sanitizeGroupsForStorage(groups);
    await writeNativeGroupsToPreferences(sanitizedGroups);
    await ensureCapacitorDataDir(GROUP_SUBDIR);
    for (const groupToWrite of sanitizedGroups) {
      const groupId = typeof groupToWrite.id === 'string' ? groupToWrite.id : '';
      if (!groupId) continue;
      const path = `${GROUP_SUBDIR}/${getGroupFilename(groupId)}`;
      try {
        await writeCapacitorTextFile(path, JSON.stringify(groupToWrite, null, 2));
      } catch (err) {
        logger.error('[CapacitorBackend] write group file failed (Preferences saved)', path, err);
      }
    }
    logger.info('[CapacitorBackend] saved groups', sanitizedGroups.length);
  }

  async deleteGroup(groupId: string): Promise<void> {
    const path = `${GROUP_SUBDIR}/${getGroupFilename(groupId)}`;
    await deleteCapacitorDataFile(path);
  }

  async loadSettings(): Promise<Record<string, unknown>> {
    try {
      const data = await readCapacitorJsonFile(SETTINGS_PATH);
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        return data as Record<string, unknown>;
      }
      const fromPrefs = await readNativeOrganiserSettingsFromPreferences();
      return fromPrefs;
    } catch (err) {
      logger.error('[CapacitorBackend] loadSettings failed', err);
      return readNativeOrganiserSettingsFromPreferences();
    }
  }

  async saveSettings(settings: Record<string, unknown>): Promise<void> {
    const payload = settings ?? {};
    await writeNativeOrganiserSettingsToPreferences(payload);
    try {
      await writeCapacitorJsonFile(SETTINGS_PATH, payload);
    } catch (err) {
      logger.error('[CapacitorBackend] saveSettings file failed (Preferences saved)', err);
    }
  }

  async getSetting(key: string, defaultValue: unknown = undefined): Promise<unknown> {
    const s = await this.loadSettings();
    return Object.prototype.hasOwnProperty.call(s, key) ? s[key] : defaultValue;
  }

  async setSetting(key: string, value: unknown): Promise<void> {
    const s = await this.loadSettings();
    s[key] = value;
    await this.saveSettings(s);
  }

  async importFromFile(file: File): Promise<OrganiserData> {
    return new Promise<OrganiserData>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          resolve(JSON.parse(e.target?.result as string) as OrganiserData);
        } catch {
          reject(new Error('Invalid JSON file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  exportToFile(data: OrganiserData): void {
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'co21-export.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      logger.warn('[CapacitorBackend] exportToFile failed', err);
    }
  }

  async getStoragePath(): Promise<string> {
    return getCapacitorDataUri(GROUP_SUBDIR);
  }
}

export const capacitorStorage = new CapacitorBackend();
