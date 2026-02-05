import * as groupService from '../group/groupService';
import { getGroupsByParent as getGroupsByParentUtil } from '../group/groupUtils';
import { computed } from 'vue';

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

    // build tree from state.organiserData when requested
    tree: computed(() => {
      const groups: any[] = state.organiserData.value.groups || [];
      const raw = groups || [];
      const map = new Map<string, any>();

      raw.forEach((g: any) => {
        map.set(String(g.id), {
          id: g.id,
          label: g.name,
          icon: g.icon,
          color: g.color,
          group: g,
          parentId: (g.parentId ?? g.parent_id ?? null) == null ? null : String(g.parentId ?? g.parent_id ?? null),
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
    }),
  } as const;
}
