import { ref } from 'vue';
import type { Ref } from 'vue';
import type { Task } from '../models/TaskModel';
import type { TaskRepository } from '../managers/taskRepository';
import type { ActiveInterface } from 'src/types/ActiveInterface';

export type PreviewPayload = string | number | Task | null;

export class TaskActive implements ActiveInterface<Task> {
  readonly task: Ref<Task | null>;
  readonly mode = ref<'add' | 'edit' | 'preview'>('add');

  constructor(
    private readonly taskRepo: TaskRepository,
    taskRef?: Ref<Task | null>,
  ) {
    this.task = taskRef ?? ref<Task | null>(null);
  }

  /** ActiveInterface: set by full object. */
  set(value: Task | null): void {
    this.setTask(value);
  }

  /** ActiveInterface: set by id string. */
  setById(id: string | null): void {
    if (!id) {
      this.setTask(null);
      return;
    }
    const found = this.taskRepo.getFlatList().find((t) => String(t.id) === String(id)) ?? null;
    this.setTask(found);
  }

  /** ActiveInterface: get current active task. */
  get(): Task | null {
    return this.task.value;
  }

  setTask(payload: PreviewPayload): void {
    if (payload === undefined) return;
    this.taskRepo.applyActiveSelection(this.task, this.mode, payload as any);
  }

  setMode(m: 'add' | 'edit' | 'preview'): void {
    this.mode.value = m;
    if (m === 'add') this.task.value = null;
  }
}
