import { markRaw, ref } from 'vue';
import { defineStore } from 'pinia';
import { TaskManager } from './managers/taskManager';
import * as timeManager from './managers/timeManager/timeManager';
import { saveData } from 'src/utils/storageUtils';
import type { Task } from './types';
import { TaskActive } from './TaskActive';
import { TaskList } from './TaskList';
import { TaskSubtaskLine } from './TaskSubtaskLine';
import { TaskStatus } from './TaskStatus';

export type { PreviewPayload } from './TaskActive';

// ── Store ─────────────────────────────────────────────────────────────────────
export const useTaskStore = defineStore('task', {
  state: () => {
    const time = markRaw(timeManager.construct());
    // Pre-create the shared active-task ref so SubtaskLineManager's watcher
    // (which looks for taskManager.apiTask.state.activeTask) is connected to
    // the same ref that TaskActive exposes to the UI.
    const taskRef = ref<Task | null>(null);
    const mgr = markRaw(new TaskManager({ time, state: { activeTask: taskRef } }));
    const active = markRaw(new TaskActive(mgr, taskRef));
    const list = markRaw(new TaskList(mgr));
    const subtaskLine = markRaw(new TaskSubtaskLine(mgr, active));
    const status = markRaw(new TaskStatus(mgr));
    return { time, mgr, active, list, subtaskLine, status };
  },

  actions: {
    async add(date: string, taskData: any) {
      const t = this.mgr.addTask(date, taskData);
      await saveData();
      return t;
    },

    async update(date: string, taskOrId: Task | string, maybeUpdates?: any) {
      this.mgr.updateTask(date, taskOrId as any, maybeUpdates);
      await saveData();
    },

    async delete(date: string, id: string) {
      const removed = this.mgr.deleteTask(date, id);
      await saveData();
      return removed;
    },
  },
});

// ── Type alias (kept for any callers that import ApiTask by name) ─────────────
export type ApiTask = ReturnType<typeof useTaskStore>;
