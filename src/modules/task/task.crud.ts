import { v4 as uuidv4 } from 'uuid';
import { Task } from './types';

// In-memory task storage using canonical Task type
const tasks: Task[] = [];

// Create
export function createTask(data: Omit<Task, 'id'>): Task {
  const now = new Date().toISOString();
  const payload: Partial<Task> = {
    ...data,
    date: (data as any).date ?? data.eventDate ?? '',
    category: (data as any).category ?? 'other',
    priority: (data as any).priority ?? 'medium',
    repeat: data.repeat ?? null,
    history: data.history ?? [],
    timeOffsetDays: data.timeOffsetDays ?? null,
    color_set: data.color_set ?? null,
    createdAt: data.createdAt ?? now,
    updatedAt: data.updatedAt ?? now,
  };
  const task = new Task({ ...(payload as any), id: uuidv4() });
  tasks.push(task);
  return task;
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
