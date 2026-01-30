import type { Task } from '../task/types';
import type { TaskGroup } from '../group/TaskGroup';

export interface DayData {
  date: string; // YYYY-MM-DD
  tasks: Task[];
  notes?: string;
}

export interface OrganiserData {
  days: Record<string, DayData>;
  groups: TaskGroup[];
  lastModified: string;
}

export type { TaskGroup };
