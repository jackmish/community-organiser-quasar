import { computed } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import * as groupManager from '../managers/groupManager';
import {
  getGroupsByParent as getGroupsByParentUtil,
  isVisibleForActive,
} from '../utils/groupUtils';
import type { Group } from './Group';

export class GroupList {
  readonly all: ComputedRef<Group[]>;
  readonly tree: ComputedRef<any>;

  constructor(
    private readonly groups: Ref<Group[]>,
    private readonly activeGroup: Ref<{ label: string; value: string | null } | null>,
  ) {
    this.all = computed(() => groups.value || []);
    this.tree = groupManager.createTreeComputed(groups as any);
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
