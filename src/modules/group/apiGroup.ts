import * as groupManager from './groupManager';
import { getGroupsByParent as getGroupsByParentUtil, isVisibleForActive } from './groupUtils';
import { computed, markRaw, ref } from 'vue';
import { saveData } from 'src/utils/storageUtils';
import { defineStore } from 'pinia';

export const useGroupStore = defineStore('group', () => {
  // ── shared reactive state ────────────────────────────────────────────────
  const activeGroup = ref<{ label: string; value: string | null } | null>(null);
  const groups = ref<any[]>([]);
  const parent = groupManager.createParentComputed(groups, activeGroup);

  // ── CRUD actions ─────────────────────────────────────────────────────────
  const add = async (payload: any) => {
    const group = groupManager.addGroup(groups.value, payload);
    await saveData();
    return group;
  };

  const update = async (groupId: string, updates: Partial<any>) => {
    groupManager.updateGroup(groups.value, groupId, updates);
    await saveData();
  };

  const del = async (groupId: string) => {
    const res = groupManager.deleteGroup(groups.value, groupId);
    await saveData();
    return res;
  };

  // ── nested namespaces ─────────────────────────────────────────────────────
  // markRaw prevents Pinia's reactive() from unwrapping the refs inside these
  // nested objects – callers can still use e.g. `list.all.value` as before.
  const list = markRaw({
    all: computed(() => groups.value || []),
    getGroupsByParent: (parentId?: string) => getGroupsByParentUtil(groups.value || [], parentId),
    setGroups: (arr: any[]) => {
      groupManager.setGroups(groups, arr);
    },
    isVisibleForActive: (candidateId: any) =>
      isVisibleForActive(groups.value || [], activeGroup.value, candidateId),
    tree: groupManager.createTreeComputed(groups),
  });

  const active = markRaw({
    activeGroup,
    parent,
    goToParent: () => groupManager.goToParent(groups, activeGroup),
    selectAll: () => {
      activeGroup.value = null;
      return null;
    },
  });

  return { add, update, delete: del, list, active };
});
