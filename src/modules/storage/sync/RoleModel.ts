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
