import type { Task } from '../TaskModel';

export class DayData {
  date: string;
  tasks: Task[];
  notes: string;

  constructor(init: { date: string; tasks?: Task[]; notes?: string }) {
    this.date = init.date;
    this.tasks = init.tasks ?? [];
    this.notes = init.notes ?? '';
  }
}
