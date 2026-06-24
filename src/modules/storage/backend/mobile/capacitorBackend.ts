/**
 * CapacitorBackend — persistence for Android / iOS.
 * Uses SQLite by default per active workspace; legacy JSON is migrated on first boot.
 */

import type { StorageBackend, OrganiserData } from '../StorageBackend';
import type { Group } from '../../../group/models/GroupModel';
import logger from '../../../../utils/logger';
import { APP_DATA_PATH_SEGMENTS, sqliteDbPathSegments } from '../../appDataPaths';
import { joinCapacitorWorkspacePath } from 'src/modules/space/capacitorSpacePaths';
import { getActiveCapacitorWorkspaceRoot } from 'src/modules/space/capacitorSpaceRegistry';
import { ensureCapacitorSqliteMigrated } from './capacitorSqliteMigration';
import {
  deleteGroupFromCapacitorSqlite,
  isCapacitorSqliteReady,
  loadAppSettingsFromCapacitorSqlite,
  loadGroupsFromCapacitorSqlite,
  saveAppSettingsToCapacitorSqlite,
  saveGroupsToCapacitorSqlite,
} from './capacitorSqliteService';
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
  writeCapacitorTextFile,
} from './capacitorAppDataFiles';
import {
  readNativeGroupsFromPreferences,
  writeNativeGroupsToPreferences,
  readNativeOrganiserSettingsFromPreferences,
  writeNativeOrganiserSettingsToPreferences,
} from './capacitorNativePreferences';

let migrationEnsured = false;

async function workspaceRoot(): Promise<string> {
  return getActiveCapacitorWorkspaceRoot();
}

async function groupSubdir(): Promise<string> {
  const root = await workspaceRoot();
  return joinCapacitorWorkspacePath(root, ...APP_DATA_PATH_SEGMENTS.group);
}

async function settingsPath(): Promise<string> {
  const root = await workspaceRoot();
  return joinCapacitorWorkspacePath(root, ...APP_DATA_PATH_SEGMENTS.organiserSettingsFile);
}

async function ensureReady(): Promise<boolean> {
  if (!migrationEnsured) {
    await ensureCapacitorSqliteMigrated();
    migrationEnsured = true;
  }
  return isCapacitorSqliteReady();
}

async function loadLegacyGroups(): Promise<Group[]> {
  const groupDir = await groupSubdir();
  const ws = await workspaceRoot();
  try {
    await ensureCapacitorDataDir(groupDir);
    const files = await listCapacitorDirNames(groupDir);
    const groups: Group[] = [];
    for (const filename of files) {
      if (!isGroupJsonFilename(filename)) continue;
      const path = `${groupDir}/${filename}`;
      try {
        const text = await readCapacitorTextFile(path);
        const parsed = parseGroupJsonText(text ?? '');
        const row = normalizeGroupFromDisk(parsed, filename);
        if (row) groups.push(row as unknown as Group);
      } catch (err) {
        logger.error('[CapacitorBackend] read group failed', path, err);
      }
    }
    if (groups.length) return groups;
    if (!ws) {
      const fromPrefs = await readNativeGroupsFromPreferences();
      return fromPrefs as unknown as Group[];
    }
    return [];
  } catch (err) {
    logger.error('[CapacitorBackend] loadLegacyGroups failed', err);
    if (!ws) {
      const fromPrefs = await readNativeGroupsFromPreferences();
      return fromPrefs as unknown as Group[];
    }
    return [];
  }
}

async function loadLegacySettings(): Promise<Record<string, unknown>> {
  const path = await settingsPath();
  const ws = await workspaceRoot();
  try {
    const data = await readCapacitorJsonFile(path);
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }
    if (!ws) {
      return readNativeOrganiserSettingsFromPreferences();
    }
    return {};
  } catch (err) {
    logger.error('[CapacitorBackend] loadLegacySettings failed', err);
    if (!ws) {
      return readNativeOrganiserSettingsFromPreferences();
    }
    return {};
  }
}

export class CapacitorBackend implements StorageBackend {
  readonly name = 'capacitor';

  isAvailable(): boolean {
    return true;
  }

  async loadAllGroups(): Promise<Group[]> {
    if (await ensureReady()) {
      const groups = await loadGroupsFromCapacitorSqlite();
      logger.info('[CapacitorBackend] loaded groups from SQLite', groups.length);
      return groups as unknown as Group[];
    }
    return loadLegacyGroups();
  }

  async saveGroups(groups: Group[]): Promise<void> {
    const sanitizedGroups = await sanitizeGroupsForStorage(groups);
    if (await ensureReady()) {
      await saveGroupsToCapacitorSqlite(sanitizedGroups);
      logger.info('[CapacitorBackend] saved groups to SQLite', sanitizedGroups.length);
      return;
    }

    const groupDir = await groupSubdir();
    const ws = await workspaceRoot();
    if (!ws) {
      await writeNativeGroupsToPreferences(sanitizedGroups);
    }
    await ensureCapacitorDataDir(groupDir);
    for (const groupToWrite of sanitizedGroups) {
      const groupId = typeof groupToWrite.id === 'string' ? groupToWrite.id : '';
      if (!groupId) continue;
      const path = `${groupDir}/${getGroupFilename(groupId)}`;
      try {
        await writeCapacitorTextFile(path, JSON.stringify(groupToWrite, null, 2));
      } catch (err) {
        logger.error('[CapacitorBackend] write group file failed', path, err);
      }
    }
    logger.info('[CapacitorBackend] saved groups (legacy)', sanitizedGroups.length);
  }

  async deleteGroup(groupId: string): Promise<void> {
    if (await ensureReady()) {
      await deleteGroupFromCapacitorSqlite(groupId);
      return;
    }
    const groupDir = await groupSubdir();
    const path = `${groupDir}/${getGroupFilename(groupId)}`;
    await deleteCapacitorDataFile(path);
  }

  async loadSettings(): Promise<Record<string, unknown>> {
    if (await ensureReady()) {
      return loadAppSettingsFromCapacitorSqlite();
    }
    return loadLegacySettings();
  }

  async saveSettings(settings: Record<string, unknown>): Promise<void> {
    const payload = settings ?? {};
    if (await ensureReady()) {
      await saveAppSettingsToCapacitorSqlite(payload);
      return;
    }
    const path = await settingsPath();
    const ws = await workspaceRoot();
    if (!ws) {
      await writeNativeOrganiserSettingsToPreferences(payload);
    }
    try {
      const { writeCapacitorJsonFile } = await import('./capacitorAppDataFiles');
      await writeCapacitorJsonFile(path, payload);
    } catch (err) {
      logger.error('[CapacitorBackend] saveSettings file failed', err);
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
    const root = await workspaceRoot();
    if (await ensureReady()) {
      return getCapacitorDataUri(joinCapacitorWorkspacePath(root, ...sqliteDbPathSegments()));
    }
    return getCapacitorDataUri(await groupSubdir());
  }
}

export const capacitorStorage = new CapacitorBackend();
