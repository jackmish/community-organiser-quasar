import { markRaw, ref } from 'vue';
import { defineStore } from 'pinia';
import { TaskManager } from './managers/taskManager';
import * as timeManager from './managers/timeManager/timeManager';
import { saveData } from 'src/utils/storageUtils';
import type { Task } from './types';
import { TaskActive } from './classes/TaskActive';
import { TaskList } from './classes/TaskList';
import { TaskSubtaskLine } from './classes/TaskSubtaskLine';
import { TaskStatus } from './classes/TaskStatus';

export type { PreviewPayload } from './classes/TaskActive';

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

  // Arrow-function fields so they are own-enumerable properties on the instance.
  // Pinia's setup-store iterates only own-enumerable properties; prototype methods
  // (regular class methods) are non-enumerable and are NOT exposed by Pinia,
  // causing "is not a function" errors at runtime for any caller that goes through
  // the Pinia store (e.g. the lazyStore proxy in apiRoot.ts).
  readonly add = async (date: string, taskData: any) => {
    const t = this.mgr.addTask(date, taskData);
    await saveData();
    return t;
  };

  readonly update = async (date: string, taskOrId: Task | string, maybeUpdates?: any) => {
    this.mgr.updateTask(date, taskOrId as any, maybeUpdates);
    await saveData();
  };

  readonly delete = async (date: string, id: string) => {
    const removed = this.mgr.deleteTask(date, id);
    await saveData();
    return removed;
  };
}

export const useTaskStore = defineStore('task', () => new TaskStore());

// ── Type alias (kept for any callers that import ApiTask by name) ─────────────
export type ApiTask = ReturnType<typeof useTaskStore>;
