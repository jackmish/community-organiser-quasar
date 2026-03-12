import { saveData } from 'src/utils/storageUtils';
import type { TaskManager } from './managers/taskManager';

export class TaskStatus {
  constructor(private readonly mgr: TaskManager) {}

  async toggleComplete(date: string, id: string): Promise<void> {
    this.mgr.toggleTaskComplete(date, id);
    await saveData();
  }

  async undoCycleDone(date: string, id: string): Promise<boolean> {
    const changed = this.mgr.undoCycleDone(date, id);
    if (changed) await saveData();
    return changed;
  }
}
