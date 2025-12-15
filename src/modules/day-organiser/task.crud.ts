import { v4 as uuidv4 } from 'uuid';
import { Task } from './task.model';

// In-memory task storage
const tasks: Task[] = [];

// Create
export function createTask(data: Omit<Task, 'id'>): Task {
  const task = new Task(
    uuidv4(),
    data.name,
    data.description,
    data.status_id,
    data.type_id,
    data.created_at,
    data.updated_at,
    data.created_by,
    data.parent_id,
  );
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
