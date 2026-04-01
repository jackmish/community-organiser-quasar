import { markRaw, ref } from 'vue';
import { defineStore } from 'pinia';
import { TaskRepository } from './managers/taskRepository';
import * as timeRepository from './managers/timeManager/timeRepository';
import { saveData } from 'src/utils/storageUtils';
import type { Task } from './models/TaskModel';
import { TaskActive } from './models/classes/TaskActive';
import { TaskList } from './models/classes/TaskList';
import { TaskSubtaskLine } from './models/classes/TaskSubtaskLine';
import { TaskStatus } from './models/classes/TaskStatus';

export type { PreviewPayload } from './models/classes/TaskActive';

class TaskController {
  readonly time = markRaw(timeRepository.construct());

  private readonly taskRef = ref<Task | null>(null);

  readonly mgr = markRaw(
    new TaskRepository({ time: this.time, state: { activeTask: this.taskRef } }),
  );
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

export const useTaskController = defineStore('task', () => new TaskController());

export type ApiTask = ReturnType<typeof useTaskController>;
