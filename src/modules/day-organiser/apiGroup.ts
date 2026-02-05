import * as groupService from '../group/groupService';
import { getGroupsByParent as getGroupsByParentUtil } from '../group/groupUtils';

// Minimal group API factory. Accepts the shared state object and keeps implementation tiny.
export function createGroupApi(state: any) {
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

    // expose the computed tree from the shared state
    tree: state.groupTree,
  } as const;
}
