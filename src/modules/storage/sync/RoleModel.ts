/**
 * RoleModel — describes a sharing/access role that can be assigned to devices
 * for a specific group.
 *
 * AccessRange:
 *   max    — access extends to all groups recursively (no restriction)
 *   child  — access includes the selected group and its direct children
 *   single — access limited to the single selected group only
 *
 * Privilege:
 *   preview — read-only view
 *   edit    — can add/modify tasks
 *   full    — full control (create sub-groups, delete, manage roles)
 */

export type AccessRange = 'max' | 'child' | 'single';
export type RolePrivilege = 'preview' | 'edit' | 'full';

export interface RoleData {
  id: string;
  name: string;
  accessRange: AccessRange;
  privilege: RolePrivilege;
  /** The group this role is scoped to. null = not yet assigned to a group. */
  groupId: string | null;
  createdAt: number;
  updatedAt: number;
}

// ── Privilege scoring ────────────────────────────────────────────────────────

/** Numeric rank for each privilege level (higher = more access). */
export const PRIVILEGE_ORDER: Record<RolePrivilege, number> = {
  preview: 1,
  edit: 2,
  full: 3,
};

/** Numeric rank for each access range (higher = more access). */
export const RANGE_ORDER: Record<AccessRange, number> = {
  single: 1,
  child: 2,
  max: 3,
};

/**
 * Combined numeric access score.
 * higher score === more access.
 */
export function roleAccessScore(privilege: RolePrivilege, accessRange: AccessRange): number {
  return PRIVILEGE_ORDER[privilege] * 10 + RANGE_ORDER[accessRange];
}

/**
 * Score for the implicit "Creator" default (no explicit role set on the group).
 * Equals full(3)*10 + max(3) = 33, the maximum explicit slot.
 */
export const CREATOR_ACCESS_SCORE = 33;

// ── Change detection ─────────────────────────────────────────────────────────

export interface PrivilegeChange {
  roleName: string;
  changeType: 'reduction' | 'extension';
  /** Formatted label for the old state (built by caller). */
  fromLabel: string;
  /** Formatted label for the new state (built by caller). */
  toLabel: string;
}

/**
 * Compare two arrays of roles and return a list of meaningful privilege changes.
 *
 * @param labelFn  Converts a privilege+accessRange pair to a human-readable string.
 * @param creatorLabel  Label to use when the implicit "Creator (default)" state is the
 *                      old or new value (no explicit role on the group).
 */
export function computeRoleChanges(
  oldRoles: RoleData[],
  newRoles: RoleData[],
  labelFn: (privilege: RolePrivilege, accessRange: AccessRange) => string,
  creatorLabel: string,
): PrivilegeChange[] {
  const changes: PrivilegeChange[] = [];

  // Edited or new roles
  for (const nr of newRoles) {
    const or = oldRoles.find((r) => r.id === nr.id);
    const newScore = roleAccessScore(nr.privilege, nr.accessRange);
    const oldScore = or ? roleAccessScore(or.privilege, or.accessRange) : CREATOR_ACCESS_SCORE;
    const fromLabel = or ? labelFn(or.privilege, or.accessRange) : creatorLabel;
    const toLabel = labelFn(nr.privilege, nr.accessRange);

    if (newScore !== oldScore) {
      changes.push({
        roleName: nr.name,
        changeType: newScore < oldScore ? 'reduction' : 'extension',
        fromLabel,
        toLabel,
      });
    }
  }

  // Deleted roles → device reverts to creator (extension)
  for (const or of oldRoles) {
    if (!newRoles.find((nr) => nr.id === or.id)) {
      changes.push({
        roleName: or.name,
        changeType: 'extension',
        fromLabel: labelFn(or.privilege, or.accessRange),
        toLabel: creatorLabel,
      });
    }
  }

  return changes;
}

// ─────────────────────────────────────────────────────────────────────────────

export class Role implements RoleData {
  id: string;
  name: string;
  accessRange: AccessRange;
  privilege: RolePrivilege;
  groupId: string | null;
  createdAt: number;
  updatedAt: number;

  constructor(data: RoleData) {
    this.id = data.id;
    this.name = data.name;
    this.accessRange = data.accessRange;
    this.privilege = data.privilege;
    this.groupId = data.groupId;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  static create(
    name: string,
    groupId: string | null,
    accessRange: AccessRange = 'single',
    privilege: RolePrivilege = 'preview',
  ): Role {
    const now = Date.now();
    return new Role({
      id: crypto.randomUUID(),
      name,
      accessRange,
      privilege,
      groupId,
      createdAt: now,
      updatedAt: now,
    });
  }

  toJSON(): RoleData {
    return {
      id: this.id,
      name: this.name,
      accessRange: this.accessRange,
      privilege: this.privilege,
      groupId: this.groupId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
