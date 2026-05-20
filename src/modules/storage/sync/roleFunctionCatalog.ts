import type { RolePrivilege } from './RoleModel';
import { PRIVILEGE_ORDER } from './RoleModel';
import type { FunctionAccessRule, RoleProfileData } from './RoleProfileModel';

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
