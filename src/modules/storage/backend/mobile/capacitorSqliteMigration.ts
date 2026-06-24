import logger from 'src/utils/logger';
import { APP_DATA_PATH_SEGMENTS } from '../../appDataPaths';
import { joinCapacitorWorkspacePath } from 'src/modules/space/capacitorSpacePaths';
import { ensureCapacitorActiveWorkspaceBound } from 'src/modules/space/capacitorSpaceRegistry';
import {
  isGroupJsonFilename,
  normalizeGroupFromDisk,
  parseGroupJsonText,
} from '../electron/groupFileLoader';
import {
  listCapacitorDirNames,
  readCapacitorJsonFile,
  readCapacitorTextFile,
  isNativeCapacitorPlatform,
} from './capacitorAppDataFiles';
import {
  readNativeCo21SettingsFromPreferences,
  readNativeGroupsFromPreferences,
  readNativeOrganiserSettingsFromPreferences,
} from './capacitorNativePreferences';
import {
  capacitorSqliteDbExistsForWorkspace,
  getCapacitorSqliteMeta,
  isCapacitorSqliteAvailable,
  openCapacitorSqliteDb,
  saveAppSettingsToCapacitorSqlite,
  saveCo21SettingsToCapacitorSqlite,
  saveGroupsToCapacitorSqlite,
  setCapacitorSqliteMeta,
  setCapacitorSqliteWorkspaceRoot,
} from './capacitorSqliteService';

function groupDirFor(workspaceRoot: string): string {
  return joinCapacitorWorkspacePath(workspaceRoot, ...APP_DATA_PATH_SEGMENTS.group);
}

function organiserSettingsPathFor(workspaceRoot: string): string {
  return joinCapacitorWorkspacePath(workspaceRoot, ...APP_DATA_PATH_SEGMENTS.organiserSettingsFile);
}

function co21SettingsPathFor(workspaceRoot: string): string {
  return joinCapacitorWorkspacePath(workspaceRoot, ...APP_DATA_PATH_SEGMENTS.co21SettingsFile);
}

function legacyCo21SettingsPathFor(workspaceRoot: string): string {
  return joinCapacitorWorkspacePath(workspaceRoot, ...APP_DATA_PATH_SEGMENTS.legacyCo21SettingsFile);
}

async function loadLegacyGroups(workspaceRoot: string): Promise<Record<string, unknown>[]> {
  const groupDir = groupDirFor(workspaceRoot);
  const groups: Record<string, unknown>[] = [];
  try {
    const files = await listCapacitorDirNames(groupDir);
    for (const filename of files) {
      if (!isGroupJsonFilename(filename)) continue;
      const text = await readCapacitorTextFile(`${groupDir}/${filename}`);
      const parsed = parseGroupJsonText(text ?? '');
      const row = normalizeGroupFromDisk(parsed, filename);
      if (row) groups.push(row);
    }
  } catch (err) {
    logger.warn('[capacitorSqliteMigration] group file read failed', err);
  }

  if (groups.length) return groups;
  if (!workspaceRoot) {
    const fromPrefs = await readNativeGroupsFromPreferences();
    return fromPrefs;
  }
  return [];
}

async function loadLegacyOrganiserSettings(workspaceRoot: string): Promise<Record<string, unknown>> {
  const fromFile = await readCapacitorJsonFile(organiserSettingsPathFor(workspaceRoot));
  if (fromFile && typeof fromFile === 'object' && !Array.isArray(fromFile)) {
    return fromFile as Record<string, unknown>;
  }
  if (!workspaceRoot) {
    return readNativeOrganiserSettingsFromPreferences();
  }
  return {};
}

async function loadLegacyCo21Settings(workspaceRoot: string): Promise<Record<string, unknown>> {
  const fromFile = await readCapacitorJsonFile(co21SettingsPathFor(workspaceRoot));
  if (fromFile && typeof fromFile === 'object' && !Array.isArray(fromFile)) {
    return fromFile as Record<string, unknown>;
  }
  const legacyFile = await readCapacitorJsonFile(legacyCo21SettingsPathFor(workspaceRoot));
  if (legacyFile && typeof legacyFile === 'object' && !Array.isArray(legacyFile)) {
    return legacyFile as Record<string, unknown>;
  }
  if (!workspaceRoot) {
    return readNativeCo21SettingsFromPreferences();
  }
  return {};
}

function hasLegacyFileData(
  groups: unknown[],
  settings: Record<string, unknown>,
  co21: Record<string, unknown>,
): boolean {
  return groups.length > 0 || Object.keys(settings).length > 0 || Object.keys(co21).length > 0;
}

export async function ensureCapacitorSqliteMigratedForWorkspace(
  workspaceRoot: string,
  options: { force?: boolean } = {},
): Promise<void> {
  if (!isNativeCapacitorPlatform()) return;
  if (!(await isCapacitorSqliteAvailable())) {
    logger.warn('[capacitorSqliteMigration] SQLite plugin unavailable — keeping file storage');
    return;
  }

  await setCapacitorSqliteWorkspaceRoot(workspaceRoot);
  await openCapacitorSqliteDb();

  if (!options.force) {
    const migratedAt = await getCapacitorSqliteMeta('migratedAt');
    if (migratedAt) return;
  }

  const dbExisted = await capacitorSqliteDbExistsForWorkspace(workspaceRoot);
  const groups = await loadLegacyGroups(workspaceRoot);
  const settings = await loadLegacyOrganiserSettings(workspaceRoot);
  const co21 = await loadLegacyCo21Settings(workspaceRoot);
  const hadLegacy = hasLegacyFileData(groups, settings, co21);

  if (hadLegacy || !dbExisted || options.force) {
    if (groups.length) {
      await saveGroupsToCapacitorSqlite(groups);
    }
    if (Object.keys(settings).length) {
      await saveAppSettingsToCapacitorSqlite(settings);
    }
    if (Object.keys(co21).length) {
      await saveCo21SettingsToCapacitorSqlite(co21);
    }
  }

  const now = new Date().toISOString();
  await setCapacitorSqliteMeta('migratedFrom', hadLegacy ? 'files' : 'none');
  await setCapacitorSqliteMeta('migratedAt', now);
  await setCapacitorSqliteMeta('storageMode', 'sqlite');

  logger.info('[capacitorSqliteMigration] SQLite ready', {
    workspaceRoot: workspaceRoot || '(system)',
    hadLegacy,
    groups: groups.length,
    settingsKeys: Object.keys(settings).length,
    co21Keys: Object.keys(co21).length,
  });
}

/**
 * Open SQLite for the active workspace and import legacy JSON / Preferences when needed.
 */
export async function ensureCapacitorSqliteMigrated(): Promise<void> {
  if (!isNativeCapacitorPlatform()) return;
  await ensureCapacitorActiveWorkspaceBound();
  const { getActiveCapacitorWorkspaceRoot } = await import('src/modules/space/capacitorSpaceRegistry');
  const workspaceRoot = await getActiveCapacitorWorkspaceRoot();
  await ensureCapacitorSqliteMigratedForWorkspace(workspaceRoot);
}
