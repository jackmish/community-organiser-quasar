import * as groupService from './groupService';
import logger from 'src/utils/logger';
import { getGroupsByParent as getGroupsByParentUtil } from './groupUtils';
import { computed, ref } from 'vue';

// Minimal group API factory. Accepts the shared state object and keeps implementation tiny.
export function createGroupApi(state: any) {
  // reuse existing shared ref if provided, otherwise create an internal one
  const activeGroup =
    state && state.activeGroup
      ? state.activeGroup
      : ref<{ label: string; value: string | null } | null>(null);

  // parent computed delegates the lookup to groupService to avoid duplication
  const parent = computed(() =>
    groupService.getParentForActive(state.organiserData.value, activeGroup.value),
  );

  return {
    add: async (payload: any) => {
      const group = groupService.addGroup(state.organiserData.value, payload);
      await state.saveData();
      return group;
    },

    update: async (groupId: string, updates: Partial<any>) => {
      groupService.updateGroup(state.organiserData.value, groupId, updates);
      await state.saveData();
    },

    delete: async (groupId: string) => {
      const res = groupService.deleteGroup(state.organiserData.value, groupId);
      await state.saveData();
      return res;
    },

    getGroupsByParent: (parentId?: string) =>
      getGroupsByParentUtil(state.organiserData.value.groups, parentId),

    // list helpers
    list: {
      all: computed(() => state.organiserData.value.groups || []),
    },

    // expose active group ref (proxy to shared store or internal ref)
    activeGroup,

    // expose parent computed
    parent,

    // navigate activeGroup to its parent (returns new activeGroup or null)
    goToParent: () => {
      try {
        const p = parent.value;
        if (!p) {
          activeGroup.value = null;
          return null;
        }
        // prefer label from parent node if available
        const label = p.label ?? p.name ?? String(p.id);
        const id = String(p.id);
        activeGroup.value = { label, value: id };
        return activeGroup.value;
      } catch (e) {
        return null;
      }
    },

    // build tree from state.organiserData when requested (uses getGroupsByParent)
    tree: computed(() => {
      const buildTree = (parentId?: string): any[] => {
        const pidNorm = parentId == null ? undefined : String(parentId);
        const groupsForParent = getGroupsByParentUtil(state.organiserData.value.groups, pidNorm);
        return (groupsForParent || []).map((group: any) => ({
          id: String(group.id),
          label: group.name,
          color: group.color,
          icon: group.icon || 'folder',
          group: group,
          children: buildTree(String(group.id)),
        }));
      };
      return buildTree();
    }),
  } as const;
}
