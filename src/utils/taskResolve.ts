/**
 * taskResolve.ts
 *
 * Shared helper to resolve a task from a polymorphic payload.
 *
 * Handles three shapes that come from calendar click events and
 * other sources throughout the app:
 *   - string / number  → treated as an id, looked up in allTasks
 *   - object with .id  → looked up by id; occurrence date merged in if present
 *   - unknown          → returns null
 */
import type { Ref } from 'vue';
import type { Task } from 'src/modules/task/models/TaskModel';

export function resolveTask(payload: any, allTasks: Ref<Task[]> | Task[]): Task | null {
  const list: Task[] = Array.isArray(allTasks) ? allTasks : (allTasks.value ?? []);
  try {
    if (typeof payload === 'string' || typeof payload === 'number') {
      const sid = String(payload);
      return list.find((t) => t.id === sid) ?? null;
    }
    if (payload && payload.id) {
      const sid = String(payload.id);
      const base = list.find((t) => t.id === sid) ?? null;
      if (base) {
        const found: Task = { ...base };
        const occ = payload.date || payload._date || payload._dateStr || payload.eventDate;
        if (occ) found.date = occ;
        return found;
      }
      // Fall back to the payload itself if no stored task found (e.g. virtual occurrence)
      return payload as Task;
    }
  } catch {
    // ignore — caller handles null
  }
  return null;
}
