import * as groupService from './groupService';
import { getGroupsByParent as getGroupsByParentUtil } from './groupUtils';
import { computed, ref } from 'vue';

// Minimal group API factory. Accepts the shared state object and keeps implementation tiny.
export function createGroupApi(state: any) {
  //// REFS - included in exported API
  const activeGroup = ref<{ label: string; value: string | null } | null>(null);
  const groups = ref<any[]>([]);
  const parent = groupService.createParentComputed(groups, activeGroup);

  return {
    add: async (payload: any) => {
      const group = groupService.addGroup(groups.value, payload);
      await state.saveData();
      return group;
    },

    update: async (groupId: string, updates: Partial<any>) => {
      groupService.updateGroup(groups.value, groupId, updates);
      await state.saveData();
    },

    delete: async (groupId: string) => {
      const res = groupService.deleteGroup(groups.value, groupId);
      await state.saveData();
      return res;
    },

    // list helpers
    list: {
      all: computed(() => groups.value || []),
      getGroupsByParent: (parentId?: string) => getGroupsByParentUtil(groups.value || [], parentId),
      setGroups: (arr: any[]) => {
        try {
          groups.value = Array.isArray(arr) ? arr : [];
        } catch (e) {
          // ignore
        }
      },
      tree: groupService.createTreeComputed(groups),
    },

    // active-related helpers grouped under `active`
    active: {
      // expose active group ref (proxy to shared store or internal ref)
      activeGroup,

      // expose parent computed
      parent,

      // navigate activeGroup to its parent (delegates to groupService.goToParent)
      goToParent: () => groupService.goToParent(groups, activeGroup),

      // clear active group selection
      selectAll: () => {
        activeGroup.value = null;
        return null;
      },
    },
  } as const;
}
