import { Collection } from 'src/utils/Collection';
import type { Task } from '../TaskModel';
import type { TaskRepository } from '../../managers/taskRepository';

export class TaskList extends Collection<Task> {
  constructor(private readonly taskRepo: TaskRepository) {
    super();
  }

  items(): Task[] {
    return this.taskRepo.getFlatList();
  }

  inRange(s: string, e: string): Task[] {
    return this.taskRepo.getTasksInRange(s, e);
  }

  byCategory(c: Task['category']): Task[] {
    return this.taskRepo.getTasksByCategory(c);
  }

  byPriority(p: Task['priority']): Task[] {
    return this.taskRepo.getTasksByPriority(p);
  }

  incomplete(): Task[] {
    return this.taskRepo.getIncompleteTasks();
  }

  forDay(d: string): Task[] {
    return this.taskRepo.getTasksForDay(String(d || ''));
  }

  /** Sort with an optional comparator; defaults to date → priority. */
  override sort(compare?: (a: Task, b: Task) => number): Task[] {
    return this.items()
      .slice()
      .sort(
        compare ?? ((a, b) => a.date.localeCompare(b.date) || a.priority.localeCompare(b.priority)),
      );
  }

  /** All tasks belonging to a specific group. */
  byGroup(groupId: string): Task[] {
    return this.items().filter((t) => String(t.groupId ?? '') === String(groupId));
  }
}
