/**
 * taskStats — Pinia plugin half
 *
 * Adds a reactive `taskStats` property to the task store.
 * Counts total / done / undone for the currently active group.
 */

import { computed } from 'vue';
import type { PiniaPluginContext } from 'pinia';
import { useGroupStore } from 'src/modules/group/apiGroup';
import type { Task } from 'src/modules/task/types';

export interface TaskStats {
  /** ID of the active group, or null when "All groups" is selected. */
  groupId: string | null;
  total: number;
  done: number;
  undone: number;
}

// Module augmentation so every store in the project knows about taskStats
declare module 'pinia' {
  export interface PiniaCustomProperties {
    taskStats: TaskStats;
  }
}

export function taskStatsPiniaPlugin({ store, pinia }: PiniaPluginContext) {
  if (store.$id !== 'task') return;

  const groupStore = useGroupStore(pinia);

  const taskStats = computed<TaskStats>(() => {
    const activeId = groupStore.active.activeGroup.value?.value ?? null;
    const allTasks: Task[] = (store as any).list.filter(() => true);
    const grouped = activeId === null ? allTasks : allTasks.filter((t) => t.groupId === activeId);
    const done = grouped.filter((t) => t.status_id === 0).length;
    return { groupId: activeId, total: grouped.length, done, undone: grouped.length - done };
  });

  Object.defineProperty(store, 'taskStats', {
    get: () => taskStats.value,
    enumerable: true,
  });
}
