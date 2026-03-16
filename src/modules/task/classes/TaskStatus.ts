import type { TaskManager } from '../managers/taskManager';

export class TaskStatus {
  constructor(
    private readonly mgr: TaskManager,
    private readonly persist: () => Promise<void>,
  ) {}

  async toggleComplete(date: string, id: string): Promise<void> {
    this.mgr.toggleTaskComplete(date, id);
    await this.persist();
  }

  async undoCycleDone(date: string, id: string): Promise<boolean> {
    const changed = this.mgr.undoCycleDone(date, id);
    if (changed) await this.persist();
    return changed;
  }
}
