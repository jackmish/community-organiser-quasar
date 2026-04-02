import type { TaskRepository } from '../../managers/taskRepository';

export class TaskStatus {
  constructor(
    private readonly taskRepo: TaskRepository,
    private readonly persist: () => Promise<void>,
  ) {}

  async toggleComplete(date: string, id: string): Promise<void> {
    this.taskRepo.toggleTaskComplete(date, id);
    await this.persist();
    try {
      const activeTask = (this.taskRepo.timeProvider as any)?.state?.activeTask;
      if (activeTask?.value && String(activeTask.value.id) === String(id)) {
        const updated = this.taskRepo.flatTasks.value.find((t: any) => String(t.id) === String(id));
        if (updated) activeTask.value = updated;
      }
    } catch (e) {
      // ignore – reactivity refresh is best-effort
    }
  }

  async undoCycleDone(date: string, id: string): Promise<boolean> {
    const changed = this.taskRepo.undoCycleDone(date, id);
    if (changed) await this.persist();
    return changed;
  }
}
