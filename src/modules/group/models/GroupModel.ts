import { BaseModel } from 'src/types/BaseModel';
import type { RoleData } from 'src/modules/storage/sync/RoleModel';

export class GroupModel extends BaseModel {
  name: string;
  color: string | undefined;
  shortcut: boolean | undefined;
  shareSubgroups: boolean | undefined;
  hideTasksFromParent: boolean | undefined;
  icon: string | undefined;
  parentId: string | undefined;
  parent_id?: string | null;
  roles: RoleData[];

  constructor(data: Partial<GroupModel> & { id?: string; name?: string } = {}) {
    // Only use data.id for the group's own identity — never fall back to parent_id,
    // which is a relationship field, not an identity field.
    const superInit: { id?: string; createdAt?: string; updatedAt?: string } = {};
    const ownId = data.id != null && String(data.id) !== '' ? String(data.id) : undefined;
    if (ownId !== undefined) superInit.id = ownId;
    if (data.createdAt !== undefined) superInit.createdAt = data.createdAt;
    if (data.updatedAt !== undefined) superInit.updatedAt = data.updatedAt;
    super(superInit);
    this.name = data.name ?? '';
    this.color = data.color;
    this.shortcut = data.shortcut;
    this.shareSubgroups = data.shareSubgroups;
    this.hideTasksFromParent = data.hideTasksFromParent;
    this.icon = data.icon;
    // Normalize parent relationship: accept both camelCase and snake_case from legacy data.
    // `parentId` is canonical going forward.
    this.parentId = (data as any).parentId ?? (data.parent_id as any) ?? undefined;
    // Keep parent_id in sync with the canonical parentId field.
    this.parent_id = this.parentId ?? null;
    this.roles = (data as any).roles ?? [];
  }

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      name: this.name,
      color: this.color,
      shortcut: this.shortcut,
      shareSubgroups: this.shareSubgroups,
      hideTasksFromParent: this.hideTasksFromParent,
      icon: this.icon,
      parentId: this.parentId,
      // parent_id mirrors parentId for backward compatibility with older persisted data.
      parent_id: this.parentId ?? null,
      roles: this.roles ?? [],
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

// Backward-compat alias — prefer `GroupModel` in new code
export { GroupModel as Group };
