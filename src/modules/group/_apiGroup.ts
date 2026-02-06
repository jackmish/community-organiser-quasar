import * as groupService from './groupService';
import { getGroupsByParent as getGroupsByParentUtil } from './groupUtils';
import { computed, ref } from 'vue';
import { app } from 'src/services/appService';
import { appSaveData } from 'src/utils/storageUtils';

// Minimal group API factory. Accepts the shared state object and keeps implementation tiny.
export function createGroupApi() {
  //// shared state REFS
  const activeGroup = ref<{ label: string; value: string | null } | null>(null);
  const groups = ref<any[]>([]);
  const parent = groupService.createParentComputed(groups, activeGroup);
  // persistence uses global `app('storage')` service (lazy-resolved)

  return {
    add: async (payload: any) => {
      const group = groupService.addGroup(groups.value, payload);
      await appSaveData();
      return group;
    },

    update: async (groupId: string, updates: Partial<any>) => {
      groupService.updateGroup(groups.value, groupId, updates);
      await appSaveData();
    },

    delete: async (groupId: string) => {
      const res = groupService.deleteGroup(groups.value, groupId);
      await appSaveData();
      return res;
    },

    // list helpers
    list: {
      all: computed(() => groups.value || []),
      getGroupsByParent: (parentId?: string) => getGroupsByParentUtil(groups.value || [], parentId),
      setGroups: (arr: any[]) => {
        groupService.setGroups(groups, arr);
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
    // persistence handled via global service `app('storage')`
  } as const;
}
