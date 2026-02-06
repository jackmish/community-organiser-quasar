import type { OrganiserData, TaskGroup } from '../day-organiser/types';
import { generateGroupId } from './groupId';
import { normalizeId as normalizeGroupId } from './groupUtils';

export type CreateGroupInput = {
  name: string;
  parentId?: string | undefined;
  color?: string | undefined;
  icon?: string | undefined;
  shareSubgroups?: boolean | undefined;
  hideTasksFromParent?: boolean | undefined;
};

export function addGroup(organiserData: OrganiserData, payload: CreateGroupInput): TaskGroup {
  const { name, parentId, color, icon, shareSubgroups, hideTasksFromParent } = payload;
  const now = new Date().toISOString();
  const group: TaskGroup = {
    id: generateGroupId(name),
    name,
    createdAt: now,
    ...(parentId && { parentId }),
    ...(color && { color }),
    ...(icon && { icon }),
    ...(typeof shareSubgroups === 'boolean' ? { shareSubgroups } : {}),
    ...(typeof hideTasksFromParent === 'boolean' ? { hideTasksFromParent } : {}),
  };

  if (!Array.isArray(organiserData.groups)) organiserData.groups = [];
  organiserData.groups.push(group);
  return group;
}

export function updateGroup(
  organiserData: OrganiserData,
  groupId: string,
  updates: Partial<Omit<TaskGroup, 'id' | 'createdAt'>>,
): void {
  const group = (organiserData.groups || []).find((g) => g.id === groupId);
  if (!group) throw new Error('Group not found');
  Object.assign(group, updates);
}

export function deleteGroup(
  organiserData: OrganiserData,
  groupId: string,
): { groupHasTasks: boolean } {
  const groupToDelete = (organiserData.groups || []).find((g) => g.id === groupId);

  const groupHasTasks = Object.values(organiserData.days || {}).some(
    (day: any) =>
      Array.isArray(day.tasks) &&
      day.tasks.some((task: any) => String(task.groupId) === String(groupId)),
  );

  // Remove group from persisted list
  organiserData.groups = (organiserData.groups || []).filter((g) => g.id !== groupId);

  // Remove groupId from all tasks
  Object.values(organiserData.days || {}).forEach((day: any) => {
    (day.tasks || []).forEach((task: any) => {
      if (task.groupId === groupId) delete task.groupId;
    });
  });

  // Move child groups to parent or root
  organiserData.groups.forEach((g: any) => {
    const pid = normalizeGroupId(g.parentId ?? g.parent_id ?? null);
    if (pid === String(groupId)) {
      const newParent = groupToDelete
        ? normalizeGroupId(groupToDelete.parentId ?? (groupToDelete as any).parent_id ?? null)
        : null;
      if (g.parentId !== undefined) {
        if (newParent) g.parentId = newParent;
        else delete g.parentId;
      } else if (g.parent_id !== undefined) {
        if (newParent) g.parent_id = newParent;
        else delete g.parent_id;
      } else {
        if (newParent) g.parentId = newParent;
      }
    }
  });

  return { groupHasTasks };
}

// Prepare groups with their tasks for persistence. Returns a new OrganiserData
// object suitable for saving to disk (groups include a `tasks` array populated
// from organiserData.days).
export function prepareGroupsForSave(organiserData: OrganiserData): OrganiserData {
  try {
    const groupsOrig = Array.isArray(organiserData.groups) ? organiserData.groups : [];
    const groupsForSave = groupsOrig.map((g: any) => ({ ...(g || {}), tasks: [] }));
    const groupIndex = new Map<string, any>();
    for (const g of groupsForSave) {
      groupIndex.set(String(g.id), g);
    }

    for (const dayKey of Object.keys(organiserData.days || {})) {
      const day = (organiserData.days || {})[dayKey];
      if (!day || !Array.isArray(day.tasks)) continue;
      for (const t of day.tasks) {
        const gid = t && (t.groupId ?? null);
        if (gid != null && groupIndex.has(String(gid))) {
          groupIndex.get(String(gid)).tasks.push(t);
        }
      }
    }

    return {
      ...organiserData,
      groups: groupsForSave,
    } as OrganiserData;
  } catch (err) {
    // If preparing groups fails for any reason, log and return organiserData as-is
    // to avoid losing data during persistence.
    console.error('prepareGroupsForSave failed:', err);
    return organiserData;
  }
}

// Return a normalized parent object for the given active group value.
// `active` may be a string id, number, or an object with `value`/`id`.
export function getParentForActive(organiserData: OrganiserData, active: unknown): any {
  try {
    if (active == null) return null;
    const maybeId =
      typeof active === 'string' || typeof active === 'number'
        ? String(active)
        : String((active && ((active as any).value ?? (active as any).id)) ?? '');
    if (!maybeId) return null;
    const groups: any[] = organiserData.groups || [];
    const g = (groups || []).find((gg: any) => String(gg.id) === maybeId);
    if (!g) return null;
    const pid = g.parentId ?? g.parent_id ?? null;
    if (pid == null) return null;
    const pg = (groups || []).find((gg: any) => String(gg.id) === String(pid)) || null;
    if (!pg) return null;
    return pg;
  } catch (err) {
    return null;
  }
}
