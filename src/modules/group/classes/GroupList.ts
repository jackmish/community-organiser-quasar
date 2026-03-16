import { computed } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import * as groupManager from '../managers/groupManager';
import {
  getGroupsByParent as getGroupsByParentUtil,
  isVisibleForActive,
} from '../utils/groupUtils';

export class GroupList {
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
