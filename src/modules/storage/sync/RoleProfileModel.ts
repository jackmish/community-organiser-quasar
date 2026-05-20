import type { AccessRange, RolePrivilege } from './RoleModel';
import { PRIVILEGE_ORDER } from './RoleModel';
import {
  defaultFunctionAccess,
  syncFunctionAccess,
  type RoleFunctionId,
} from './roleFunctionCatalog';

/** Per-app-function access for one role profile. */
export interface FunctionAccessRule {
  functionId: RoleFunctionId;
  enabled: boolean;
  privilege: RolePrivilege;
}

/** Named role with function privileges and group-tree reach when assigned to a group. */
export interface RoleProfileData {
  id: string;
  name: string;
  /** How far a device assignment on a group extends to descendant groups. */
  accessRange: AccessRange;
  functionAccess: FunctionAccessRule[];
  createdAt: number;
  updatedAt: number;
}

function stringField(v: unknown, fallback: string): string {
  if (typeof v === 'string') return v.length ? v : fallback;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return fallback;
}

function parseAccessRange(v: unknown): AccessRange | null {
  if (v === 'single' || v === 'child' || v === 'max') return v;
  return null;
}

function parsePrivilege(v: unknown): RolePrivilege | null {
  if (v === 'preview' || v === 'edit' || v === 'full') return v;
  return null;
}

export function createRoleProfile(name: string): RoleProfileData {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name,
    accessRange: 'single',
    functionAccess: defaultFunctionAccess(),
    createdAt: now,
    updatedAt: now,
  };
}

/** @deprecated Legacy group matrix entry — only used when migrating saved settings. */
export interface GroupAccessRule {
  groupId: string;
  enabled: boolean;
  accessRange: AccessRange;
  privilege: RolePrivilege;
}

export function migrateLegacyGroupAccess(
  groupAccess: GroupAccessRule[],
): { accessRange: AccessRange; functionAccess: FunctionAccessRule[] } {
  const enabled = groupAccess.filter((g) => g.enabled);
  const functionAccess = defaultFunctionAccess();
  if (!enabled.length) {
    return { accessRange: 'single', functionAccess };
  }
  let accessRange: AccessRange = enabled[0]?.accessRange ?? 'single';
  let maxPriv: RolePrivilege = 'preview';
  for (const g of enabled) {
    const ar = parseAccessRange(g.accessRange);
    if (ar) accessRange = ar;
    const p = parsePrivilege(g.privilege);
    if (p && PRIVILEGE_ORDER[p] > PRIVILEGE_ORDER[maxPriv]) maxPriv = p;
  }
  for (const f of functionAccess) {
    f.enabled = true;
    f.privilege = maxPriv;
  }
  return { accessRange, functionAccess };
}
