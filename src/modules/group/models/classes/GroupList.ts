import { computed } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import * as groupRepository from '../../managers/groupRepository';
import {
  getGroupsByParent as getGroupsByParentUtil,
  isVisibleForActive,
} from '../../utils/groupUtils';
import type { Group } from '../GroupModel';

export class GroupList {
  readonly all: ComputedRef<Group[]>;
  readonly tree: ComputedRef<any>;

  constructor(
    private readonly groups: Ref<Group[]>,
    private readonly activeGroup: Ref<{ label: string; value: string | null } | null>,
  ) {
    this.all = computed(() => groups.value || []);
    this.tree = groupRepository.createTreeComputed(groups as any);
  }

  getGroupsByParent(parentId?: string) {
    return getGroupsByParentUtil(this.groups.value || [], parentId);
  }

  setGroups(arr: any[]) {
    groupRepository.setGroups(this.groups, arr);
  }

  isVisibleForActive(candidateId: any) {
    return isVisibleForActive(this.groups.value || [], this.activeGroup.value, candidateId);
  }
}
