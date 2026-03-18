import { computed } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import * as groupManager from '../managers/groupManager';

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

  /**
   * Activate a given group (set as the active group in the app).
   * Accepts a group object with `id`/`value`/`name` or a primitive id.
   */
  activate(g: any) {
    try {
      if (!g) return;
      const gid = typeof g === 'object' ? String(g.id ?? g.value ?? '') : String(g);
      if (!gid) return;
      this.activeGroup.value = { label: g.name || String(gid), value: String(gid) };
    } catch (e) {
      void e;
    }
  }

  // legacy-friendly alias if callers expect a terse name
  API(g: any) {
    return this.activate(g);
  }
}
