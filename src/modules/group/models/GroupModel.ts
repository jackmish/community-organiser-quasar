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
    const resolvedId = String(data.id ?? data.parent_id ?? '') || undefined;
    const superInit: { id?: string; createdAt?: string; updatedAt?: string } = {};
    if (resolvedId !== undefined) superInit.id = resolvedId;
    if (data.createdAt !== undefined) superInit.createdAt = data.createdAt;
    if (data.updatedAt !== undefined) superInit.updatedAt = data.updatedAt;
    super(superInit);
    this.name = data.name ?? '';
    this.color = data.color;
    this.shortcut = data.shortcut;
    this.shareSubgroups = data.shareSubgroups;
    this.hideTasksFromParent = data.hideTasksFromParent;
    this.icon = data.icon;
    this.parentId = (data as any).parentId ?? (data.parent_id as any) ?? undefined;
    this.parent_id = data.parent_id ?? null;
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
      parent_id: this.parent_id ?? null,
      roles: this.roles ?? [],
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

// Backward-compat alias — prefer `GroupModel` in new code
export { GroupModel as Group };
