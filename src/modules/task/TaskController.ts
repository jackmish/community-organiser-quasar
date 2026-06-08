import { markRaw, ref } from 'vue';
import { defineStore } from 'pinia';
import { getSharedTaskRepository } from './managers/taskRepository';
import * as timeRepository from './managers/timeManager/timeRepository';
import { saveData } from 'src/utils/storageUtils';
import type { Task } from './models/TaskModel';
import { TaskActive } from './models/classes/TaskActive';
import { TaskList } from './models/classes/TaskList';
import { TaskSubtaskLine } from './models/classes/TaskSubtaskLine';
import { TaskStatus } from './models/classes/TaskStatus';
import type { Controllable } from 'src/types/Controllable';
import type { StoragePort } from 'src/modules/storage/StorageController';

export type { PreviewPayload } from './models/classes/TaskActive';

class TaskController implements Controllable {
  readonly controllerName = 'task' as const;
  readonly time = markRaw(timeRepository.construct());

  private readonly taskRef = ref<Task | null>(null);

  readonly taskRepo = markRaw(getSharedTaskRepository());
  readonly active = markRaw(new TaskActive(this.taskRepo, this.taskRef));
  readonly list = markRaw(new TaskList(this.taskRepo));
  readonly subtaskLine = markRaw(new TaskSubtaskLine(this.taskRepo, this.active, saveData));
  readonly status = markRaw(new TaskStatus(this.taskRepo, saveData));

  constructor() {
    this.taskRepo.timeProvider = { time: this.time, state: { activeTask: this.taskRef } };
    this.taskRepo.setTime(this.time);
  }

  /** Expose the time slice to StorageController via the CC registry. */
  readonly storagePort = (): StoragePort => ({ kind: 'time', data: this.time });

  readonly add = async (date: string, taskData: any) => {
    const t = this.taskRepo.addTask(date, taskData);
    await saveData();
    return t;
  };

  readonly update = async (date: string, taskOrId: Task | string, maybeUpdates?: any) => {
    this.taskRepo.updateTask(date, taskOrId, maybeUpdates);
    await saveData();
  };

  readonly delete = async (date: string, id: string) => {
    let groupId: string | undefined;
    try {
      const media = this.taskRepo.getMediaFlatList().find((t) => String(t.id) === String(id));
      if (media?.groupId) groupId = String(media.groupId);
      const day = this.time.days?.value?.[date];
      const task = day?.tasks?.find((t: { id?: string }) => String(t?.id) === String(id));
      if (task?.groupId) groupId = String(task.groupId);
    } catch {
      void 0;
    }
    const removed = this.taskRepo.deleteTask(date, id);
    if (removed) {
      const { recordTaskDeletion } = await import(
        'src/modules/storage/sync/taskDeletionLog'
      );
      await recordTaskDeletion(id, groupId ? { groupId } : {});
    }
    await saveData();
    return removed;
  };

  /** Rebuild flat task list from `time.days` (e.g. after LAN sync wrote days directly). */
  readonly refreshFlatListFromDays = (): void => {
    try {
      this.taskRepo.migrateMediaTasksFromDays();
      const days = this.time?.days?.value ?? {};
      const newList = this.taskRepo.listFromDays(days);
      this.taskRepo.flatTasksRef.value.splice(0, this.taskRepo.flatTasksRef.value.length, ...newList);
    } catch {
      void 0;
    }
  };
}

export const TaskStoreController = defineStore('task', () => new TaskController());
