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

// ── Store class ───────────────────────────────────────────────────────────────
class TaskStore {
  readonly time = markRaw(timeManager.construct());

  // Pre-create the shared active-task ref so SubtaskLineManager's watcher
  // (which looks for taskManager.apiTask.state.activeTask) is connected to
  // the same ref that TaskActive exposes to the UI.
  private readonly taskRef = ref<Task | null>(null);

  readonly mgr = markRaw(new TaskManager({ time: this.time, state: { activeTask: this.taskRef } }));
  readonly active = markRaw(new TaskActive(this.mgr, this.taskRef));
  readonly list = markRaw(new TaskList(this.mgr));
  readonly subtaskLine = markRaw(new TaskSubtaskLine(this.mgr, this.active, saveData));
  readonly status = markRaw(new TaskStatus(this.mgr, saveData));

  async add(date: string, taskData: any) {
    const t = this.mgr.addTask(date, taskData);
    await saveData();
    return t;
  }

  async update(date: string, taskOrId: Task | string, maybeUpdates?: any) {
    this.mgr.updateTask(date, taskOrId as any, maybeUpdates);
    await saveData();
  }

  async delete(date: string, id: string) {
    const removed = this.mgr.deleteTask(date, id);
    await saveData();
    return removed;
  }
}

export const useTaskStore = defineStore('task', () => new TaskStore());

// ── Type alias (kept for any callers that import ApiTask by name) ─────────────
export type ApiTask = ReturnType<typeof useTaskStore>;
