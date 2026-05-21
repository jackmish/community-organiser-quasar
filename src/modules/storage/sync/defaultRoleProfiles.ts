import type { AccessRange, RolePrivilege } from './RoleModel';
import type { FunctionAccessRule, RoleProfileData } from './RoleProfileModel';
import {
  ROLE_FUNCTION_IDS,
  syncFunctionAccess,
  type RoleFunctionId,
} from './roleFunctionCatalog';

/** Stable ids — same on every install when defaults are seeded. */
export const DEFAULT_ROLE_PROFILE_IDS = {
  owner: 'co21-role-owner',
  editor: 'co21-role-editor',
  taskTaker: 'co21-role-task-taker',
  infoscreen: 'co21-role-infoscreen',
} as const;

function buildFunctionAccess(
  overrides: Partial<Record<RoleFunctionId, { enabled: boolean; privilege: RolePrivilege }>>,
): FunctionAccessRule[] {
  return syncFunctionAccess(
    ROLE_FUNCTION_IDS.map((functionId) => {
      const rule = overrides[functionId];
      return {
        functionId,
        enabled: rule?.enabled ?? false,
        privilege: rule?.privilege ?? 'preview',
      };
    }),
  );
}

function profile(
  id: string,
  name: string,
  accessRange: AccessRange,
  functionAccess: FunctionAccessRule[],
  now: number,
): RoleProfileData {
  return { id, name, accessRange, functionAccess, createdAt: now, updatedAt: now };
}

/** Four starter roles shown when none exist in settings yet. */
export function createDefaultRoleProfiles(): RoleProfileData[] {
  const now = Date.now();
  return [
    profile(
      DEFAULT_ROLE_PROFILE_IDS.owner,
      'Owner',
      'max',
      buildFunctionAccess({
        tasks: { enabled: true, privilege: 'full' },
        groups: { enabled: true, privilege: 'full' },
        calendar: { enabled: true, privilege: 'full' },
        connections: { enabled: true, privilege: 'full' },
        community: { enabled: true, privilege: 'full' },
      }),
      now,
    ),
    profile(
      DEFAULT_ROLE_PROFILE_IDS.editor,
      'Editor',
      'child',
      buildFunctionAccess({
        tasks: { enabled: true, privilege: 'edit' },
        groups: { enabled: true, privilege: 'edit' },
        calendar: { enabled: true, privilege: 'edit' },
        connections: { enabled: true, privilege: 'preview' },
        community: { enabled: true, privilege: 'edit' },
      }),
      now,
    ),
    profile(
      DEFAULT_ROLE_PROFILE_IDS.taskTaker,
      'Task taker',
      'child',
      buildFunctionAccess({
        tasks: { enabled: true, privilege: 'edit' },
        groups: { enabled: true, privilege: 'preview' },
        calendar: { enabled: true, privilege: 'preview' },
      }),
      now,
    ),
    profile(
      DEFAULT_ROLE_PROFILE_IDS.infoscreen,
      'Infoscreen',
      'single',
      buildFunctionAccess({
        tasks: { enabled: true, privilege: 'preview' },
        calendar: { enabled: true, privilege: 'preview' },
        community: { enabled: true, privilege: 'preview' },
      }),
      now,
    ),
  ];
}

export function ensureDefaultRoleProfiles(existing: RoleProfileData[]): RoleProfileData[] {
  if (existing.length > 0) return existing;
  return createDefaultRoleProfiles();
}
