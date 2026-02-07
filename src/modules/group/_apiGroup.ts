import * as groupManager from './groupManager';
import { getGroupsByParent as getGroupsByParentUtil } from './groupUtils';
import { computed, ref } from 'vue';
import { app } from 'src/services/appService';
import { saveData } from 'src/utils/storageUtils';

// Minimal group API factory. Accepts the shared state object and keeps implementation tiny.
export function construct() {
  //// shared state REFS
  const activeGroup = ref<{ label: string; value: string | null } | null>(null);
  const groups = ref<any[]>([]);
  const parent = groupManager.createParentComputed(groups, activeGroup);
  // persistence uses global `app('storage')` service (lazy-resolved)

  return {
    add: async (payload: any) => {
      const group = groupManager.addGroup(groups.value, payload);
      await saveData();
      return group;
    },

    update: async (groupId: string, updates: Partial<any>) => {
      groupManager.updateGroup(groups.value, groupId, updates);
      await saveData();
    },

    delete: async (groupId: string) => {
      const res = groupManager.deleteGroup(groups.value, groupId);
      await saveData();
      return res;
    },

    // list helpers
    list: {
      all: computed(() => groups.value || []),
      getGroupsByParent: (parentId?: string) => getGroupsByParentUtil(groups.value || [], parentId),
      setGroups: (arr: any[]) => {
        groupManager.setGroups(groups, arr);
      },
      tree: groupManager.createTreeComputed(groups),
    },

    // active-related helpers grouped under `active`
    active: {
      // expose active group ref (proxy to shared store or internal ref)
      activeGroup,

      // expose parent computed
      parent,

      // navigate activeGroup to its parent (delegates to groupManager.goToParent)
      goToParent: () => groupManager.goToParent(groups, activeGroup),

      // clear active group selection
      selectAll: () => {
        activeGroup.value = null;
        return null;
      },
    },
    // persistence handled via global service `app('storage')`
  } as const;
}
