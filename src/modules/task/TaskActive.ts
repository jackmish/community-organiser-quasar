import { ref } from 'vue';
import type { Task } from './types';
import type { TaskManager } from './managers/taskManager';

export type PreviewPayload = string | number | Task | null;

export class TaskActive {
  readonly task = ref<Task | null>(null);
  readonly mode = ref<'add' | 'edit' | 'preview'>('add');

  constructor(private readonly mgr: TaskManager) {}

  setTask(payload: PreviewPayload): void {
    if (payload === undefined) return;
    this.mgr.applyActiveSelection(this.task, this.mode, payload as any);
  }

  setMode(m: 'add' | 'edit' | 'preview'): void {
    this.mode.value = m;
    if (m === 'add') this.task.value = null;
  }
}
