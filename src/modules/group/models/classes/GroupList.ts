import { computed } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { Collection } from 'src/utils/Collection';
import * as groupRepository from '../../managers/groupRepository';
import {
  getGroupsByParent as getGroupsByParentUtil,
  isVisibleForActive,
} from '../../utils/groupUtils';
import type { Group } from '../GroupModel';

export class GroupList extends Collection<Group> {
  readonly all: ComputedRef<Group[]>;
  readonly tree: ComputedRef<any>;

  constructor(
    private readonly groups: Ref<Group[]>,
    private readonly activeGroup: Ref<{ label: string; value: string | null } | null>,
  ) {
    super();
    this.all = computed(() => groups.value || []);
    this.tree = groupRepository.createTreeComputed(groups as any);
  }

  items(): Group[] {
    return this.groups.value || [];
  }

  getGroupsByParent(parentId?: string): Group[] {
    return getGroupsByParentUtil(this.groups.value || [], parentId);
  }

  setGroups(arr: any[]): void {
    groupRepository.setGroups(this.groups, arr);
  }

  isVisibleForActive(candidateId: any): boolean {
    return isVisibleForActive(this.groups.value || [], this.activeGroup.value, candidateId);
  }

  /** Find a group by its id. */
  find(id: string): Group | undefined {
    return this.first((g) => String(g.id) === String(id));
  }

  /** Groups whose direct parent matches parentId (undefined = root groups). */
  byParent(parentId?: string): Group[] {
    return this.getGroupsByParent(parentId);
  }
}
