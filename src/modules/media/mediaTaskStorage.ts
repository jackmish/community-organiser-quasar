import type { Task } from 'src/modules/task/models/TaskModel';
import { isMediaTaskTypeId } from './mediaTaskTypes';

export type DayBucket = { date: string; tasks: unknown[]; notes: string };

function asRecordId(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function asTaskTypeId(row: Record<string, unknown>): string {
  const typeId = row.type_id ?? row.type;
  if (typeof typeId === 'string') return typeId;
  return '';
}

export function partitionTasksByKind(tasks: unknown[]): {
  calendar: unknown[];
  media: unknown[];
} {
  const calendar: unknown[] = [];
  const media: unknown[] = [];
  for (const row of tasks) {
    if (!row || typeof row !== 'object') continue;
    const typeId = asTaskTypeId(row as Record<string, unknown>);
    if (isMediaTaskTypeId(typeId)) media.push(row);
    else calendar.push(row);
  }
  return { calendar, media };
}

export function calendarTaskDateKey(task: Record<string, unknown>): string {
  const rawDate = task.date ?? task.eventDate;
  if (typeof rawDate === 'string' || typeof rawDate === 'number') {
    return String(rawDate).slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

/** Build day buckets + flat media list from persisted group records. */
export function ingestGroupsTaskData(
  groups: Array<Record<string, unknown>>,
): { days: Record<string, DayBucket>; mediaTasks: Task[] } {
  const days: Record<string, DayBucket> = {};
  const mediaTasks: Task[] = [];
  const seenMediaIds = new Set<string>();

  for (const grp of groups) {
    const gid = typeof grp.id === 'string' ? grp.id : '';
    if (!gid) continue;

    const rawTasks = Array.isArray(grp.tasks) ? grp.tasks : [];
    const rawMedia = Array.isArray(grp.mediaTasks) ? grp.mediaTasks : [];
    const combined = [...rawTasks, ...rawMedia];
    const { calendar, media } = partitionTasksByKind(combined);

    for (const row of calendar) {
      if (!row || typeof row !== 'object') continue;
      const task = row as Record<string, unknown>;
      const dateKey = calendarTaskDateKey(task);
      if (!days[dateKey]) days[dateKey] = { date: dateKey, tasks: [], notes: '' };
      if (!task.groupId) task.groupId = gid;
      days[dateKey].tasks.push(task);
    }

    for (const row of media) {
      if (!row || typeof row !== 'object') continue;
      const task = row as Record<string, unknown>;
      const id = asRecordId(task.id);
      if (id && seenMediaIds.has(id)) continue;
      if (id) seenMediaIds.add(id);
      if (!task.groupId) task.groupId = gid;
      mediaTasks.push(task as unknown as Task);
    }
  }

  return { days, mediaTasks };
}

/** Attach calendar + media task arrays onto group save payloads. */
export function attachTasksToGroupsForSave(
  groups: Array<Record<string, unknown>>,
  days: Record<string, DayBucket>,
  mediaTasks: Task[],
): Array<Record<string, unknown>> {
  const groupsMap: Record<string, Record<string, unknown>> = {};

  for (const g of groups) {
    const id = asRecordId(g?.id);
    if (!id) continue;
    const meta = { ...g };
    delete meta.tasks;
    delete meta.mediaTasks;
    groupsMap[id] = { ...meta, tasks: [], mediaTasks: [] };
  }

  for (const dKey of Object.keys(days || {})) {
    const day = days[dKey];
    if (!day || !Array.isArray(day.tasks)) continue;
    for (const t of day.tasks) {
      if (!t || typeof t !== 'object') continue;
      const row = t as Record<string, unknown>;
      const gid = asRecordId(row.groupId);
      if (isMediaTaskTypeId(asTaskTypeId(row))) {
        if (!gid) continue;
        if (!groupsMap[gid]) groupsMap[gid] = { id: gid, name: gid, tasks: [], mediaTasks: [] };
        const list = groupsMap[gid].mediaTasks as unknown[];
        const rowId = asRecordId(row.id);
        if (!list.some((x) => asRecordId((x as { id?: unknown }).id) === rowId)) {
          list.push(row);
        }
        continue;
      }
      if (!gid) continue;
      if (!groupsMap[gid]) groupsMap[gid] = { id: gid, name: gid, tasks: [], mediaTasks: [] };
      const list = groupsMap[gid].tasks as unknown[];
      const rowId = asRecordId(row.id);
      if (!list.some((x) => asRecordId((x as { id?: unknown }).id) === rowId)) {
        list.push(row);
      }
    }
  }

  for (const t of mediaTasks) {
    const gid = asRecordId(t?.groupId);
    if (!gid) continue;
    if (!groupsMap[gid]) groupsMap[gid] = { id: gid, name: gid, tasks: [], mediaTasks: [] };
    const list = groupsMap[gid].mediaTasks as unknown[];
    const taskId = asRecordId(t.id);
    if (!list.some((x) => asRecordId((x as { id?: unknown }).id) === taskId)) {
      list.push(t);
    }
  }

  return Object.keys(groupsMap)
    .map((k) => groupsMap[k])
    .filter((g): g is Record<string, unknown> => Boolean(g));
}
