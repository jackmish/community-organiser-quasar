import type { OrganiserData, TaskGroup } from '../day-organiser/types';
import { computed } from 'vue';
import type { Ref } from 'vue';
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

export function addGroup(
  organiserData: OrganiserData | any[],
  payload: CreateGroupInput,
): TaskGroup {
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

  // Allow callers to pass either the full organiserData object or the groups array directly.
  if (Array.isArray(organiserData)) {
    organiserData.push(group);
  } else {
    if (!Array.isArray(organiserData.groups)) organiserData.groups = [];
    organiserData.groups.push(group);
  }
  return group;
}

function _ensureGroupsAndDays(src: any): { groups: any[]; days: Record<string, any> } {
  if (Array.isArray(src)) return { groups: src, days: {} };
  return { groups: src.groups || [], days: src.days || {} };
}

export function updateGroup(
  organiserData: OrganiserData | any[],
  groupId: string,
  updates: Partial<Omit<TaskGroup, 'id' | 'createdAt'>>,
): void {
  const { groups } = _ensureGroupsAndDays(organiserData);
  const group = (groups || []).find((g: any) => g.id === groupId);
  if (!group) throw new Error('Group not found');
  Object.assign(group, updates);
}

export function deleteGroup(
  organiserData: OrganiserData | any[],
  groupId: string,
): { groupHasTasks: boolean } {
  const src: any = organiserData;
  const { groups, days } = _ensureGroupsAndDays(src);
  const groupToDelete = (groups || []).find((g: any) => g.id === groupId);

  const groupHasTasks = Object.values(days || {}).some(
    (day: any) =>
      Array.isArray(day.tasks) &&
      day.tasks.some((task: any) => String(task.groupId) === String(groupId)),
  );

  // Remove group from persisted list
  const newGroups = (groups || []).filter((g: any) => g.id !== groupId);
  if (Array.isArray(src)) {
    // caller passed an array reference: mutate it in place
    src.length = 0;
    newGroups.forEach((g: any) => src.push(g));
  } else {
    src.groups = newGroups;
  }

  // Remove groupId from all tasks
  Object.values(days || {}).forEach((day: any) => {
    (day.tasks || []).forEach((task: any) => {
      if (task.groupId === groupId) delete task.groupId;
    });
  });

  // Move child groups to parent or root
  (src.groups || []).forEach((g: any) => {
    const pid = normalizeGroupId(g.parentId ?? g.parent_id ?? null);
    if (pid === String(groupId)) {
      const newParent = groupToDelete
        ? normalizeGroupId(groupToDelete.parentId ?? groupToDelete.parent_id ?? null)
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
export function getParentForActive(
  organiserData: OrganiserData | { groups?: any[]; days?: Record<string, any> },
  active: unknown,
): any {
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

// Create a computed parent lookup bound to reactive refs.
export function createParentComputed(groupsRef: Ref<any[]>, activeRef: Ref<unknown>) {
  return computed(() => getParentForActive({ groups: groupsRef.value }, activeRef.value));
}
