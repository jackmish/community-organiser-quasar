import type { TaskRepository } from '../../managers/taskRepository';
import type { TaskActive } from './TaskActive';

export class TaskSubtaskLine {
  get parsedLines() {
    return this.taskRepo.managers.subtaskLine.parsedLines;
  }

  constructor(
    private readonly taskRepo: TaskRepository,
    private readonly active: TaskActive,
    private readonly persist: () => Promise<void>,
  ) {}

  async add(text: string) {
    const res = await this.taskRepo.managers.subtaskLine.add(this.active.task.value, text);
    try {
      if (res && res.newDesc) await this.persist();
    } catch (err) {
      try {
        console.error('subtaskLine.add: failed to save data', err);
      } catch (e) {
        void e;
      }
    }
    return res;
  }

  async toggleStatus(task: any, lineIndex: number) {
    const res = await this.taskRepo.managers.subtaskLine.toggleStatus(task, lineIndex);
    if (res && res.newDesc) await this.persist();
    return res;
  }

  async remove(lineIndex: number) {
    const res = await this.taskRepo.managers.subtaskLine.remove(this.active.task.value, lineIndex);
    try {
      if (res && res.newDesc !== undefined) await this.persist();
    } catch (err) {
      try {
        console.error('subtaskLine.remove: failed to save data', err);
      } catch (e) {
        void e;
      }
    }
    return res;
  }
}
