export type TaskDuration = 0 | 1 | 2 | 3 | 4 | 5 | 6;

import type { TaskGroup } from '../group/TaskGroup';
export type { TaskGroup };

export interface Task {
  id: string;
  name: string;
  description: string;
  date: string; // YYYY-MM-DD format
  category: 'work' | 'personal' | 'meeting' | 'other';
  priority: 'low' | 'medium' | 'high' | 'critical';
  // Numeric status code for the task lifecycle (e.g. 0 = done, 1 = just created)
  status_id?: number | string | undefined;
  // Type of task, e.g. 'TimeEvent' or 'Todo'
  type_id?: string;
  // Alternate event date field; some code uses `eventDate` instead of `date`
  eventDate?: string;
  // `completed` kept for backward compatibility but will be deprecated
  // legacy `completed` field removed; use `status_id` (0 = done) instead
  groupId?: string; // Reference to TaskGroup
  tags?: string[];
  eventTime?: string; // HH:mm format
  // Canonical repeat settings for cyclic tasks
  repeat?: Record<string, unknown> | null;
  // History of changes for this task
  history?: Array<Record<string, unknown>>;
  // Time mode controls how the event is shown: 'event' (on date),
  // 'prepare' (appear in days-before window), or 'expiration' (appear until done)
  timeMode?: 'event' | 'prepare' | 'expiration';
  // Number of days before the event when prepare/expiration modes start showing
  timeOffsetDays?: number | null;
  // Optional per-task chosen color set id (e.g. 'set-1'..'set-12')
  color_set?: string | null;
  createdAt: string;
  updatedAt: string;
}

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
