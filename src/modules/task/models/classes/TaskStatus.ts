import type { TaskManager } from "../../managers/taskManager";

export class TaskStatus {
  constructor(
    private readonly mgr: TaskManager,
    private readonly persist: () => Promise<void>
  ) {}

  async toggleComplete(date: string, id: string): Promise<void> {
    this.mgr.toggleTaskComplete(date, id);
    await this.persist();
    // toggleTaskComplete mutates the raw task object directly, bypassing Vue's
    // reactive proxy set-trap.  Refresh activeTask.value so any computed that
    // reads `activeTask.value.status_id` (e.g. `isDone` in TaskPreview) reacts.
    try {
      const activeTask = (this.mgr.apiTask as any)?.state?.activeTask;
      if (activeTask?.value && String(activeTask.value.id) === String(id)) {
        const updated = this.mgr.flatTasks.value.find(
          (t: any) => String(t.id) === String(id)
        );
        if (updated) activeTask.value = updated;
      }
    } catch (e) {
      // ignore – reactivity refresh is best-effort
    }
  }

  async undoCycleDone(date: string, id: string): Promise<boolean> {
    const changed = this.mgr.undoCycleDone(date, id);
    if (changed) await this.persist();
    return changed;
  }
}
