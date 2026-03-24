import { ref } from 'vue';
import type { Ref } from 'vue';
import type { Task } from '../models/TaskModel';
import type { TaskManager } from '../managers/taskManager';

export type PreviewPayload = string | number | Task | null;

export class TaskActive {
  readonly task: Ref<Task | null>;
  readonly mode = ref<'add' | 'edit' | 'preview'>('add');

  constructor(
    private readonly mgr: TaskManager,
    taskRef?: Ref<Task | null>,
  ) {
    this.task = taskRef ?? ref<Task | null>(null);
  }

  setTask(payload: PreviewPayload): void {
    if (payload === undefined) return;
    this.mgr.applyActiveSelection(this.task, this.mode, payload as any);
  }

  setMode(m: 'add' | 'edit' | 'preview'): void {
    this.mode.value = m;
    if (m === 'add') this.task.value = null;
  }
}
