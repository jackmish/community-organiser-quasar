import logger from 'src/utils/logger';

import type { AccessRange, RolePrivilege } from './RoleModel';

import type { FunctionAccessRule, GroupAccessRule, RoleProfileData } from './RoleProfileModel';

import { migrateLegacyGroupAccess } from './RoleProfileModel';

import { ROLE_FUNCTION_IDS, syncFunctionAccess, type RoleFunctionId } from './roleFunctionCatalog';
import { ensureDefaultRoleProfiles } from './defaultRoleProfiles';

function isRoleFunctionId(id: string): id is RoleFunctionId {
  return (ROLE_FUNCTION_IDS as readonly string[]).includes(id);
}



type SettingsJson = Record<string, unknown>;



/** Electron IPC cannot clone Vue reactive proxies — persist plain JSON only. */

function toPlainJson<T>(value: T): T {

  return JSON.parse(JSON.stringify(value)) as T;

}



function serializeRoleProfiles(profiles: RoleProfileData[]): RoleProfileData[] {

  return profiles.map((p) => ({

    id: p.id,

    name: p.name,

    accessRange: p.accessRange,

    createdAt: p.createdAt,

    updatedAt: p.updatedAt,

    functionAccess: p.functionAccess.map((g) => ({

      functionId: g.functionId,

      enabled: !!g.enabled,

      privilege: g.privilege,

    })),

  }));

}



async function readSettingsFile(): Promise<SettingsJson | null> {

  try {

    const api = (window as unknown as { electronAPI?: Record<string, unknown> }).electronAPI;

    if (!api || typeof api.getAppDataPath !== 'function') return null;

    const appPath = await (api.getAppDataPath as () => Promise<string>)();

    const settingsDir = (api.joinPath as (a: string, b: string) => string)(appPath, 'co21');

    const settingsFile = (api.joinPath as (a: string, b: string) => string)(settingsDir, 'settings.json');

    const exists = await (api.fileExists as (p: string) => Promise<boolean>)(settingsFile);

    if (!exists) return {};

    const data = await (api.readJsonFile as (p: string) => Promise<unknown>)(settingsFile);

    return data && typeof data === 'object' ? (data as SettingsJson) : {};

  } catch (e) {

    logger.warn('[roleProfileSettings] read failed', e);

    return null;

  }

}



async function writeSettingsFile(patch: SettingsJson): Promise<boolean> {

  try {

    const api = (window as unknown as { electronAPI?: Record<string, unknown> }).electronAPI;

    if (!api || typeof api.getAppDataPath !== 'function') return false;

    const appPath = await (api.getAppDataPath as () => Promise<string>)();

    const settingsDir = (api.joinPath as (a: string, b: string) => string)(appPath, 'co21');

    const settingsFile = (api.joinPath as (a: string, b: string) => string)(settingsDir, 'settings.json');

    await (api.ensureDir as (p: string) => Promise<void>)(settingsDir);

    const existing = (await readSettingsFile()) ?? {};

    const payload = toPlainJson({

      ...existing,

      ...patch,

    });

    await (api.writeJsonFile as (p: string, d: unknown) => Promise<void>)(settingsFile, payload);

    return true;

  } catch (e) {

    logger.error('[roleProfileSettings] write failed', e);

    return false;

  }

}



function parseFunctionAccess(raw: unknown): FunctionAccessRule[] {

  const rules: FunctionAccessRule[] = [];

  if (!Array.isArray(raw)) return syncFunctionAccess(rules);

  for (const item of raw) {

    if (!item || typeof item !== 'object') continue;

    const o = item as Record<string, unknown>;

    const rawId = typeof o.functionId === 'string' ? o.functionId : '';

    if (!isRoleFunctionId(rawId)) continue;

    const functionId = rawId;

    const privilege = o.privilege;

    if (privilege !== 'preview' && privilege !== 'edit' && privilege !== 'full') continue;

    rules.push({

      functionId,

      enabled: !!o.enabled,

      privilege,

    });

  }

  return syncFunctionAccess(rules);

}



function parseLegacyGroupAccess(raw: unknown): GroupAccessRule[] {

  const groupAccess: GroupAccessRule[] = [];

  if (!Array.isArray(raw)) return groupAccess;

  for (const g of raw) {

    if (!g || typeof g !== 'object') continue;

    const gr = g as Record<string, unknown>;

    const groupId = typeof gr.groupId === 'string' ? gr.groupId : '';

    if (!groupId) continue;

    const accessRange = gr.accessRange;

    const privilege = gr.privilege;

    if (accessRange !== 'single' && accessRange !== 'child' && accessRange !== 'max') continue;

    if (privilege !== 'preview' && privilege !== 'edit' && privilege !== 'full') continue;

    groupAccess.push({

      groupId,

      enabled: !!gr.enabled,

      accessRange,

      privilege,

    });

  }

  return groupAccess;

}



function parseProfiles(raw: unknown): RoleProfileData[] {

  if (!Array.isArray(raw)) return [];

  const out: RoleProfileData[] = [];

  for (const item of raw) {

    if (!item || typeof item !== 'object') continue;

    const o = item as Record<string, unknown>;

    const id = typeof o.id === 'string' ? o.id : '';

    const name = typeof o.name === 'string' ? o.name : '';

    if (!id || !name) continue;



    let accessRange: AccessRange =

      o.accessRange === 'single' || o.accessRange === 'child' || o.accessRange === 'max'

        ? o.accessRange

        : 'single';

    let functionAccess = parseFunctionAccess(o.functionAccess);



    if (!Array.isArray(o.functionAccess) && Array.isArray(o.groupAccess)) {

      const migrated = migrateLegacyGroupAccess(parseLegacyGroupAccess(o.groupAccess));

      accessRange = migrated.accessRange;

      functionAccess = migrated.functionAccess;

    }



    out.push({

      id,

      name,

      accessRange,

      functionAccess,

      createdAt: typeof o.createdAt === 'number' ? o.createdAt : Date.now(),

      updatedAt: typeof o.updatedAt === 'number' ? o.updatedAt : Date.now(),

    });

  }

  return out;

}



export async function loadCo21Settings(): Promise<SettingsJson> {
  const data = await readSettingsFile();
  return data ?? {};
}

export async function loadRoleProfiles(): Promise<RoleProfileData[]> {
  const data = await readSettingsFile();
  const parsed = parseProfiles(data?.roleProfiles);
  const profiles = ensureDefaultRoleProfiles(parsed);
  if (!parsed.length && profiles.length > 0) {
    await saveRoleProfiles(profiles);
  }
  return profiles;
}



export async function saveRoleProfiles(profiles: RoleProfileData[]): Promise<boolean> {

  return writeSettingsFile({ roleProfiles: serializeRoleProfiles(profiles) });

}



/** Merge a patch into `co21/settings.json` without dropping other keys (e.g. roleProfiles). */

export async function patchCo21Settings(patch: SettingsJson): Promise<boolean> {
  if ('devices' in patch && patch.devices !== undefined) {
    logger.warn(
      '[roleProfileSettings] patchCo21Settings ignored `devices` — use saveConnectedDevices()',
    );
    const { devices: _ignored, ...safe } = patch;
    return writeSettingsFile(safe);
  }
  return writeSettingsFile(patch);
}


