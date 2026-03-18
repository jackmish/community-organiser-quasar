export class Group {
  id: string;
  name: string;
  color: string | undefined;
  shortcut: boolean | undefined;
  shareSubgroups: boolean | undefined;
  hideTasksFromParent: boolean | undefined;
  icon: string | undefined;
  parentId: string | undefined;
  parent_id?: string | null;
  createdAt: string;

  constructor(data: Partial<Group> & { id?: string; name?: string } = {}) {
    this.id = String(data.id ?? data.parent_id ?? '') || '';
    this.name = data.name ?? '';
    this.color = data.color;
    this.shortcut = data.shortcut;
    this.shareSubgroups = data.shareSubgroups;
    this.hideTasksFromParent = data.hideTasksFromParent;
    this.icon = data.icon;
    this.parentId = (data as any).parentId ?? (data.parent_id as any) ?? undefined;
    this.parent_id = data.parent_id ?? null;
    this.createdAt = data.createdAt ?? new Date().toISOString();
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
      createdAt: this.createdAt,
    };
  }
}
