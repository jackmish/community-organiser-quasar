import { saveData } from 'src/utils/storageUtils';
import type { TaskManager } from './managers/taskManager';
import type { TaskActive } from './TaskActive';

export class TaskSubtaskLine {
  // Delegate to the manager's parsedLines — it is watcher-backed and updates
  // automatically whenever the active task's description changes.
  get parsedLines() {
    return this.mgr.managers.subtaskLine.parsedLines;
  }

  constructor(
    private readonly mgr: TaskManager,
    private readonly active: TaskActive,
  ) {}

  async add(text: string) {
    const res = await this.mgr.managers.subtaskLine.add(this.active.task.value, text);
    try {
      if (res && res.newDesc) await saveData();
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
    const res = await this.mgr.managers.subtaskLine.toggleStatus(task, lineIndex);
    if (res && res.newDesc) await saveData();
    return res;
  }
}
