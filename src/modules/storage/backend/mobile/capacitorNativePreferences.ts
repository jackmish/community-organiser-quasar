import { Preferences } from '@capacitor/preferences';
import logger from 'src/utils/logger';
import { isNativeCapacitorPlatform } from './capacitorAppDataFiles';

const KEY_GROUPS = 'co21.v1.groups';
const KEY_ORGANISER_SETTINGS = 'co21.v1.organiser-settings';
const KEY_CO21_SETTINGS = 'co21.v1.co21-settings';

async function readJson(key: string): Promise<unknown> {
  if (!isNativeCapacitorPlatform()) return null;
  try {
    const { value } = await Preferences.get({ key });
    if (!value?.trim()) return null;
    return JSON.parse(value) as unknown;
  } catch (err) {
    logger.error('[capacitorNativePreferences] read failed', key, err);
    return null;
  }
}

async function writeJson(key: string, data: unknown): Promise<void> {
  if (!isNativeCapacitorPlatform()) return;
  try {
    await Preferences.set({ key, value: JSON.stringify(data) });
  } catch (err) {
    logger.error('[capacitorNativePreferences] write failed', key, err);
    throw err;
  }
}

export async function readNativeGroupsFromPreferences(): Promise<Record<string, unknown>[]> {
  const raw = await readJson(KEY_GROUPS);
  if (!Array.isArray(raw)) return [];
  return raw.filter((g) => g && typeof g === 'object') as Record<string, unknown>[];
}

export async function writeNativeGroupsToPreferences(groups: unknown[]): Promise<void> {
  await writeJson(KEY_GROUPS, groups);
}

export async function readNativeOrganiserSettingsFromPreferences(): Promise<Record<string, unknown>> {
  const raw = await readJson(KEY_ORGANISER_SETTINGS);
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

export async function writeNativeOrganiserSettingsToPreferences(
  settings: Record<string, unknown>,
): Promise<void> {
  await writeJson(KEY_ORGANISER_SETTINGS, settings);
}

export async function readNativeCo21SettingsFromPreferences(): Promise<Record<string, unknown>> {
  const raw = await readJson(KEY_CO21_SETTINGS);
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

export async function writeNativeCo21SettingsToPreferences(
  settings: Record<string, unknown>,
): Promise<void> {
  await writeJson(KEY_CO21_SETTINGS, settings);
}
