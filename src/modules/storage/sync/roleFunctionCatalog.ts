import type { RolePrivilege } from './RoleModel';
import { PRIVILEGE_ORDER, RANGE_ORDER } from './RoleModel';
import type { FunctionAccessRule, RoleProfileData } from './RoleProfileModel';
import { DEFAULT_ROLE_PROFILE_IDS } from './defaultRoleProfiles';

/** App areas that roles can grant access to (not community groups). */
export const ROLE_FUNCTION_IDS = [
  'tasks',
  'groups',
  'calendar',
  'connections',
  'community',
] as const;

export type RoleFunctionId = (typeof ROLE_FUNCTION_IDS)[number];

export function defaultFunctionAccessRule(functionId: RoleFunctionId): FunctionAccessRule {
  return { functionId, enabled: false, privilege: 'preview' };
}

export function defaultFunctionAccess(): FunctionAccessRule[] {
  return ROLE_FUNCTION_IDS.map((id) => defaultFunctionAccessRule(id));
}

export function syncFunctionAccess(access: FunctionAccessRule[]): FunctionAccessRule[] {
  const byId = new Map(access.map((a) => [a.functionId, a]));
  return ROLE_FUNCTION_IDS.map((id) => {
    const existing = byId.get(id);
    return existing
      ? { functionId: id, enabled: !!existing.enabled, privilege: existing.privilege }
      : defaultFunctionAccessRule(id);
  });
}

export function roleHasEnabledFunctions(profile: RoleProfileData): boolean {
  return profile.functionAccess.some((f) => f.enabled);
}

export function maxPrivilegeFromProfile(profile: RoleProfileData): RolePrivilege {
  let max: RolePrivilege = 'preview';
  for (const f of profile.functionAccess) {
    if (!f.enabled) continue;
    if (PRIVILEGE_ORDER[f.privilege] > PRIVILEGE_ORDER[max]) {
      max = f.privilege;
    }
  }
  return max;
}

/** Built-in roles: fixed weakest → strongest order in assignment UI. */
const BUILTIN_ROLE_SORT_TIER: Record<string, number> = {
  [DEFAULT_ROLE_PROFILE_IDS.infoscreen]: 10,
  [DEFAULT_ROLE_PROFILE_IDS.taskTaker]: 20,
  [DEFAULT_ROLE_PROFILE_IDS.editor]: 30,
  [DEFAULT_ROLE_PROFILE_IDS.owner]: 40,
};

/** How much each app area contributes to overall role strength (groups weigh highest). */
const FUNCTION_STRENGTH_WEIGHT: Record<RoleFunctionId, number> = {
  tasks: 4,
  calendar: 1,
  connections: 2,
  community: 2,
  groups: 8,
};

/**
 * Overall role strength for sorting (weakest first).
 * Uses per-function privileges — not max(privilege) alone (Editor vs Task taker both had "edit" on tasks).
 */
export function roleProfileStrengthScore(profile: RoleProfileData): number {
  const builtin = BUILTIN_ROLE_SORT_TIER[profile.id];
  if (builtin !== undefined) return builtin;

  let score = RANGE_ORDER[profile.accessRange] ?? 0;
  for (const f of syncFunctionAccess(profile.functionAccess)) {
    if (!f.enabled) continue;
    const weight = FUNCTION_STRENGTH_WEIGHT[f.functionId] ?? 1;
    score += weight * PRIVILEGE_ORDER[f.privilege];
  }
  return score;
}

export function sortRoleProfilesByStrength(profiles: RoleProfileData[]): RoleProfileData[] {
  return [...profiles]
    .filter((p) => roleHasEnabledFunctions(p))
    .sort((a, b) => {
      const diff = roleProfileStrengthScore(a) - roleProfileStrengthScore(b);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
}
