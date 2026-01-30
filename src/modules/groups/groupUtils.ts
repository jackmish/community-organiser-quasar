import type { TaskGroup } from './types';

// Normalize various possible id shapes into a string id or null
export const normalizeId = (v: any): string | null => {
  if (v == null) return null;
  if (typeof v === 'object') return (v.value ?? v.id) ? String(v.value ?? v.id) : null;
  return String(v);
};

// Return groups whose parent matches `parentId` (both can be null/undefined)
export const getGroupsByParent = (groups: TaskGroup[] = [], parentId?: string): TaskGroup[] => {
  const norm = parentId == null ? null : String(parentId);
  return (groups || []).filter((g: any) => {
    const pid = normalizeId(g.parentId ?? g.parent_id ?? null);
    if (pid == null && norm == null) return true;
    if (pid != null && norm != null) return String(pid) === norm;
    return false;
  });
};

// Build a tree of group nodes for UI. Nodes reference original group objects and do NOT mutate them.
export const buildGroupTree = (groups: TaskGroup[] = []) => {
  const raw = groups || [];
  const map = new Map<string, any>();

  raw.forEach((g: any) => {
    map.set(String(g.id), {
      id: g.id,
      label: g.name,
      icon: g.icon,
      color: g.color,
      group: g,
      parentId: normalizeId(g.parentId ?? g.parent_id ?? null),
      shareSubgroups: g.shareSubgroups ?? false,
      hideTasksFromParent: g.hideTasksFromParent ?? false,
      children: [] as any[],
    });
  });

  const roots: any[] = [];
  map.forEach((node) => {
    if (node.parentId == null) {
      roots.push(node);
    } else {
      const parent = map.get(String(node.parentId));
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
  });
  return roots;
};
