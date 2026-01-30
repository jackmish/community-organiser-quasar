import { v4 as uuidv4 } from 'uuid';
import type { Task } from './types';

// In-memory task storage using canonical Task type
const tasks: Task[] = [];

// Create
export function createTask(data: Omit<Task, 'id'>): Task {
  const now = new Date().toISOString();
  const task = {
    id: uuidv4(),
    name: data.name,
    description: data.description,
    date: (data as any).date ?? data.eventDate ?? '',
    category: (data as any).category ?? 'other',
    priority: (data as any).priority ?? 'medium',
    status_id: data.status_id,
    type_id: data.type_id,
    eventDate: data.eventDate,
    groupId: data.groupId,
    tags: data.tags,
    eventTime: data.eventTime,
    repeat: data.repeat ?? null,
    history: data.history ?? [],
    timeMode: data.timeMode,
    timeOffsetDays: data.timeOffsetDays ?? null,
    color_set: data.color_set ?? null,
    createdAt: data.createdAt ?? now,
    updatedAt: data.updatedAt ?? now,
  };
  tasks.push(task as Task);
  return task as Task;
}

// Read (get by id)
export function getTask(id: string): Task | undefined {
  return tasks.find((t) => t.id === id);
}

// Update
export function updateTask(id: string, updates: Partial<Omit<Task, 'id'>>): Task | undefined {
  const task = getTask(id);
  if (!task) return undefined;
  Object.assign(task, updates);
  return task;
}

// Delete
export function deleteTask(id: string): boolean {
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  tasks.splice(idx, 1);
  return true;
}

// List all
export function listTasks(): Task[] {
  return [...tasks];
}
