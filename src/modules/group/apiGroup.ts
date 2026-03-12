import * as groupManager from './groupManager';
import { getGroupsByParent as getGroupsByParentUtil, isVisibleForActive } from './groupUtils';
import { computed, markRaw, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { saveData } from 'src/utils/storageUtils';
import { defineStore } from 'pinia';

// ── Namespace classes ─────────────────────────────────────────────────────────

class GroupList {
  readonly all: ComputedRef<any[]>;
  readonly tree: ComputedRef<any>;

  constructor(
    private readonly groups: Ref<any[]>,
    private readonly activeGroup: Ref<{ label: string; value: string | null } | null>,
  ) {
    this.all = computed(() => groups.value || []);
    this.tree = groupManager.createTreeComputed(groups);
  }

  getGroupsByParent(parentId?: string) {
    return getGroupsByParentUtil(this.groups.value || [], parentId);
  }

  setGroups(arr: any[]) {
    groupManager.setGroups(this.groups, arr);
  }

  isVisibleForActive(candidateId: any) {
    return isVisibleForActive(this.groups.value || [], this.activeGroup.value, candidateId);
  }
}

class GroupActive {
  readonly activeGroup: Ref<{ label: string; value: string | null } | null>;
  readonly parent: ComputedRef<any>;

  constructor(
    private readonly groups: Ref<any[]>,
    activeGroupRef: Ref<{ label: string; value: string | null } | null>,
  ) {
    this.activeGroup = activeGroupRef;
    this.parent = groupManager.createParentComputed(groups, activeGroupRef);
  }

  goToParent() {
    return groupManager.goToParent(this.groups, this.activeGroup);
  }

  selectAll() {
    this.activeGroup.value = null;
    return null;
  }
}

// ── Store ─────────────────────────────────────────────────────────────────────
export const useGroupStore = defineStore('group', () => {
  const groups = ref<any[]>([]);
  const activeGroupRef = ref<{ label: string; value: string | null } | null>(null);
  const list = markRaw(new GroupList(groups, activeGroupRef));
  const active = markRaw(new GroupActive(groups, activeGroupRef));

  return {
    list,
    active,

    async add(payload: any) {
      const group = groupManager.addGroup(groups.value, payload);
      await saveData();
      return group;
    },

    async update(groupId: string, updates: Partial<any>) {
      groupManager.updateGroup(groups.value, groupId, updates);
      await saveData();
    },

    async delete(groupId: string) {
      const res = groupManager.deleteGroup(groups.value, groupId);
      await saveData();
      return res;
    },
  };
});
