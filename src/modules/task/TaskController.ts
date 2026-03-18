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

class TaskStore {
  readonly time = markRaw(timeManager.construct());

  private readonly taskRef = ref<Task | null>(null);

  readonly mgr = markRaw(new TaskManager({ time: this.time, state: { activeTask: this.taskRef } }));
  readonly active = markRaw(new TaskActive(this.mgr, this.taskRef));
  readonly list = markRaw(new TaskList(this.mgr));
  readonly subtaskLine = markRaw(new TaskSubtaskLine(this.mgr, this.active, saveData));
  readonly status = markRaw(new TaskStatus(this.mgr, saveData));

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

export type ApiTask = ReturnType<typeof useTaskStore>;
