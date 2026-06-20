import logger from 'src/utils/logger';
import { isNativeCapacitorPlatform } from './capacitorAppDataFiles';
import {
  listCapacitorDirNames,
  readCapacitorJsonFile,
  readCapacitorTextFile,
  writeCapacitorJsonFile,
  writeCapacitorTextFile,
} from './capacitorAppDataFiles';
import {
  readNativeGroupsFromPreferences,
  writeNativeCo21SettingsToPreferences,
  writeNativeGroupsToPreferences,
  writeNativeOrganiserSettingsToPreferences,
} from './capacitorNativePreferences';

const GROUP_SUBDIR = 'storage/group';
const LEGACY_GROUPS_KEY = 'day-organiser-groups';
const LEGACY_SETTINGS_KEY = 'day-organiser-settings';
const CO21_SETTINGS_PATH = 'co21/settings.json';
const LEGACY_CO21_SETTINGS_KEY = 'co21-settings.json';
const MIGRATION_FLAG_PATH = 'storage/.migrated-from-web-storage';

function readLocalStorageJson(key: string): unknown {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw?.trim()) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function legacyGroupId(group: object): string {
  const raw = (group as { id?: unknown }).id;
  if (typeof raw === 'string') return raw.trim();
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  return '';
}

/** One-time import from WebView localStorage into durable native stores. */
export async function migrateLegacyWebStorageToCapacitorFiles(): Promise<void> {
  if (!isNativeCapacitorPlatform()) return;

  const already = await readCapacitorJsonFile(MIGRATION_FLAG_PATH);
  if (already && typeof already === 'object' && (already as { done?: boolean }).done) {
    return;
  }

  let migrated = false;

  try {
    const existingGroupFiles = await listCapacitorDirNames(GROUP_SUBDIR);
    const hasGroupFiles = existingGroupFiles.some(
      (name) => name.startsWith('group-') && name.endsWith('.json'),
    );
    if (!hasGroupFiles) {
      const legacyGroups = readLocalStorageJson(LEGACY_GROUPS_KEY);
      if (Array.isArray(legacyGroups) && legacyGroups.length) {
        await writeNativeGroupsToPreferences(legacyGroups);
        for (const group of legacyGroups) {
          if (!group || typeof group !== 'object') continue;
          const id = legacyGroupId(group);
          if (!id) continue;
          await writeCapacitorTextFile(
            `${GROUP_SUBDIR}/group-${id}.json`,
            JSON.stringify(group, null, 2),
          );
        }
        migrated = true;
        logger.info('[capacitorStorageMigration] imported groups from localStorage');
      }
    } else {
      const prefGroups = await readNativeGroupsFromPreferences();
      if (!prefGroups.length) {
        const loaded: unknown[] = [];
        for (const filename of existingGroupFiles) {
          if (!filename.startsWith('group-') || !filename.endsWith('.json')) continue;
          const text = await readCapacitorTextFile(`${GROUP_SUBDIR}/${filename}`);
          if (!text?.trim()) continue;
          try {
            loaded.push(JSON.parse(text) as unknown);
          } catch {
            void 0;
          }
        }
        if (loaded.length) {
          await writeNativeGroupsToPreferences(loaded);
          migrated = true;
          logger.info('[capacitorStorageMigration] mirrored file groups to Preferences');
        }
      }
    }

    const existingCo21 = await readCapacitorJsonFile(CO21_SETTINGS_PATH);
    if (!existingCo21) {
      const legacyCo21 = readLocalStorageJson(LEGACY_CO21_SETTINGS_KEY);
      if (legacyCo21 && typeof legacyCo21 === 'object') {
        await writeNativeCo21SettingsToPreferences(legacyCo21 as Record<string, unknown>);
        await writeCapacitorJsonFile(CO21_SETTINGS_PATH, legacyCo21);
        migrated = true;
        logger.info('[capacitorStorageMigration] imported co21 settings from localStorage');
      }
    }

    const existingOrganiserSettings = await readCapacitorJsonFile('storage/settings.json');
    if (!existingOrganiserSettings) {
      const legacySettings = readLocalStorageJson(LEGACY_SETTINGS_KEY);
      if (legacySettings && typeof legacySettings === 'object') {
        await writeNativeOrganiserSettingsToPreferences(legacySettings as Record<string, unknown>);
        await writeCapacitorJsonFile('storage/settings.json', legacySettings);
        migrated = true;
        logger.info('[capacitorStorageMigration] imported organiser settings from localStorage');
      }
    }

    await writeCapacitorJsonFile(MIGRATION_FLAG_PATH, {
      done: true,
      migrated,
      at: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[capacitorStorageMigration] failed', err);
  }
}
