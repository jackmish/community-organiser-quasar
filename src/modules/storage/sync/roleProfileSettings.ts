import logger from 'src/utils/logger';
import {
  readCo21SettingsBlob,
  writeCo21SettingsBlob,
  type Co21SettingsJson,
} from './co21SettingsPersistence';

import type { AccessRange, RolePrivilege } from './RoleModel';

import type { FunctionAccessRule, GroupAccessRule, RoleProfileData } from './RoleProfileModel';

import { migrateLegacyGroupAccess } from './RoleProfileModel';

import { ROLE_FUNCTION_IDS, syncFunctionAccess, type RoleFunctionId } from './roleFunctionCatalog';
import { ensureDefaultRoleProfiles, syncBuiltInRoleProfileTemplates } from './defaultRoleProfiles';

function isRoleFunctionId(id: string): id is RoleFunctionId {
  return (ROLE_FUNCTION_IDS as readonly string[]).includes(id);
}



type SettingsJson = Co21SettingsJson;



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
    return await readCo21SettingsBlob();
  } catch (e) {
    logger.warn('[roleProfileSettings] read failed', e);
    return null;
  }
}

async function writeSettingsFile(patch: SettingsJson): Promise<boolean> {
  return writeCo21SettingsBlob(toPlainJson(patch));
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

    if (
      privilege !== 'preview' &&
      privilege !== 'work' &&
      privilege !== 'edit' &&
      privilege !== 'full'
    ) {
      continue;
    }

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

    if (
      privilege !== 'preview' &&
      privilege !== 'work' &&
      privilege !== 'edit' &&
      privilege !== 'full'
    ) {
      continue;
    }

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
  let profiles = ensureDefaultRoleProfiles(parsed);
  const synced = syncBuiltInRoleProfileTemplates(profiles);
  profiles = synced.profiles;
  if (!parsed.length && profiles.length > 0) {
    await saveRoleProfiles(profiles);
  } else if (synced.changed) {
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


