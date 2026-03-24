import type { Task } from '../task/models/TaskModel';
import type { Group } from '../group/models/GroupModel';

export interface DayData {
  date: string; // YYYY-MM-DD
  tasks: Task[];
  notes?: string;
}

export interface OrganiserData {
  days: Record<string, DayData>;
  groups: Group[];
  lastModified: string;
}

export type { Group };
