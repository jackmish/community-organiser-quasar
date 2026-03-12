import type { Task } from './types';
import type { TaskManager } from './managers/taskManager';

export class TaskList {
  constructor(private readonly mgr: TaskManager) {}

  all() {
    return this.mgr.getAll().slice();
  }

  inRange(s: string, e: string) {
    return this.mgr.getTasksInRange(s, e);
  }

  byCategory(c: Task['category']) {
    return this.mgr.getTasksByCategory(c);
  }

  byPriority(p: Task['priority']) {
    return this.mgr.getTasksByPriority(p);
  }

  incomplete() {
    return this.mgr.getIncompleteTasks();
  }

  filter(fn: (t: Task) => boolean) {
    return this.mgr.getAll().filter(fn);
  }

  sort(compare?: (a: Task, b: Task) => number) {
    return this.mgr
      .getAll()
      .slice()
      .sort(
        compare ??
          ((a: Task, b: Task) =>
            a.date.localeCompare(b.date) || a.priority.localeCompare(b.priority)),
      );
  }

  forDay(d: string) {
    return this.mgr.getTasksForDay(String(d || ''));
  }

  aggregate<R>(fn: (acc: R, t: Task) => R, init: R) {
    return this.mgr.getAll().reduce(fn, init);
  }
}
