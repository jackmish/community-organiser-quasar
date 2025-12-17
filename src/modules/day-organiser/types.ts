export type TaskDuration = 0 | 1.0 | 2.0 | 3.0 | 4.0 | 5.0 | 6.0;

export interface TaskGroup {
  id: string;
  name: string;
  color?: string;
  parentId?: string; // For hierarchical groups
  createdAt: string;
}

export interface Task {
  id: string;
  name: string;
  description: string;
  date: string; // YYYY-MM-DD format
  category: 'work' | 'personal' | 'meeting' | 'other';
  priority: 'low' | 'medium' | 'high' | 'critical';
  completed: boolean;
  groupId?: string; // Reference to TaskGroup
  tags?: string[];
  eventTime?: string; // HH:mm format
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
