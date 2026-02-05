import type { TaskGroup } from './TaskGroup';

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
// Note: tree-building moved into the group API factory (apiGroup.createGroupApi)

// Determine whether a candidate group id should be visible when `activeGroupValue` is selected.
export const isVisibleForActive = (
  groups: TaskGroup[] = [],
  activeGroupValue: any,
  candidateId: any,
) => {
  if (!activeGroupValue || activeGroupValue.value === null) return true;
  if (candidateId == null) return false;
  const activeId = String(activeGroupValue.value ?? activeGroupValue);
  const cid = String(candidateId);
  if (cid === activeId) return true;

  const getGroupById = (id: any) => (groups || []).find((g: any) => String(g.id) === String(id));
  const node = getGroupById(cid);
  if (!node) return false;

  const parentId = node.parentId ?? node.parent_id ?? null;
  if (parentId == null) return false;
  if (String(parentId) === activeId) {
    if (node.hideTasksFromParent) return false;
    return true;
  }

  let childNode: any = node;
  let cur = getGroupById(parentId);
  while (cur) {
    if (childNode && childNode.hideTasksFromParent) return false;
    if (!cur.shareSubgroups) return false;
    const curParent = cur.parentId ?? cur.parent_id ?? null;
    if (curParent == null) return false;
    if (String(curParent) === activeId) return true;
    childNode = cur;
    cur = getGroupById(curParent);
  }
  return false;
};
