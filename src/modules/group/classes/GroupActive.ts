import { computed } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import * as groupManager from '../managers/groupManager';
import type { Group } from './Group';
import type { ActiveInterface } from '../ActiveInterface';

/**
 * Manage the currently active group. Uses a generic group type `G`
 * (defaults to `Group`) so callers can pass either raw records or
 * richer model instances. The helper methods `set` and `setById`
 * provide a clearer API surface than callers doing lookups themselves.
 */
export class GroupActive<
  G extends { id?: any; name?: string; label?: string; value?: any } = Group,
> implements ActiveInterface<G> {
  readonly activeGroup: Ref<{ label: string; value: string | null } | null>;
  readonly parent: ComputedRef<any>;

  constructor(
    private readonly groups: Ref<G[]>,
    activeGroupRef: Ref<{ label: string; value: string | null } | null>,
  ) {
    this.activeGroup = activeGroupRef;
    this.parent = groupManager.createParentComputed(groups as any, activeGroupRef as any);
  }

  goToParent() {
    return groupManager.goToParent(this.groups, this.activeGroup);
  }

  selectAll() {
    this.activeGroup.value = null;
    return null;
  }
  // Simple `set` and `setById` implementations with no type-guessing.
  // `set` expects a full group object; `setById` expects a string id.
  setById(id: string | null) {
    if (id == null) {
      this.activeGroup.value = null;
      return;
    }
    this.activeGroup.value = { label: id, value: id };
  }

  set(g: G | null) {
    if (g == null) {
      this.activeGroup.value = null;
      return;
    }
    const id = String((g as any).id ?? (g as any).value ?? '');
    const label = (g as any).name ?? (g as any).label ?? id;
    this.activeGroup.value = { label, value: id };
  }

  get(): G | null {
    try {
      const val = this.activeGroup.value;
      if (!val || !val.value) return null;
      const found = (this.groups?.value || []).find((x: any) => String(x.id) === String(val.value));
      return (found as G) || null;
    } catch (e) {
      return null;
    }
  }
}
