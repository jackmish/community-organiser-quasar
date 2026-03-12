import { computed } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import * as groupManager from './groupManager';

export class GroupActive {
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
