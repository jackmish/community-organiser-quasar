import type { Task } from '../models/TaskModel';
import {
  dayOfMonthFromYmdString,
  getCycleType,
  getRepeatDays,
  monthFromYmdString,
  occursOnDay,
  parseYmdLocal,
} from './occursOnDay';
import { getTimeOffsetDaysForTask, todayString } from 'src/utils/dateUtils';

const HORIZON_PAST_DAYS = 730;
const HORIZON_FUTURE_DAYS = 1095;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function formatYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDaysYmd(ymd: string, delta: number): string {
  const d = parseYmdLocal(ymd) || new Date();
  d.setDate(d.getDate() + delta);
  return formatYmdLocal(d);
}

function weekdayKeyForDay(day: string): string {
  const d = parseYmdLocal(day) || new Date(day);
  return WEEKDAY_KEYS[d.getDay()] ?? 'sun';
}

function normalizeRepeatWeekday(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const s = String(value).toLowerCase().trim();
  const fullMap: Record<string, string> = {
    sunday: 'sun',
    monday: 'mon',
    tuesday: 'tue',
    wednesday: 'wed',
    thursday: 'thu',
    friday: 'fri',
    saturday: 'sat',
  };
  if (fullMap[s]) return fullMap[s];
  if (s.length >= 3) {
    const short = s.slice(0, 3);
    if ((WEEKDAY_KEYS as readonly string[]).includes(short)) return short;
  }
  if (/^[0-6]$/.test(s)) {
    const idx = Number(s);
    return WEEKDAY_KEYS[idx] ?? null;
  }
  return null;
}

function taskSeedDatePart(task: Task): string | null {
  const evDate =
    (task as any)?.repeat?.eventDate ??
    (task as any)?.repeat?.date ??
    task.eventDate ??
    task.date ??
    null;
  if (!evDate) return null;
  if (typeof evDate === 'string') {
    return evDate.indexOf('T') !== -1 ? (evDate.split('T')[0] ?? evDate) : evDate;
  }
  if (evDate instanceof Date) return formatYmdLocal(evDate);
  return String(evDate);
}

function monthOccursOnDay(task: Task, day: string): boolean {
  const evPart = taskSeedDatePart(task);
  if (!evPart) return false;
  const target = parseYmdLocal(day) || new Date(day);
  const seed = parseYmdLocal(evPart) || new Date(evPart);
  if (isNaN(seed.getTime())) return false;
  const fromString = dayOfMonthFromYmdString(evPart);
  const desiredDay = fromString ?? seed.getDate();
  const year = target.getFullYear();
  const month = target.getMonth();
  const daysInTargetMonth = new Date(year, month + 1, 0).getDate();
  const effectiveDay = Math.min(desiredDay, daysInTargetMonth);
  return effectiveDay === target.getDate();
}

function yearOccursOnDay(task: Task, day: string): boolean {
  const evPart = taskSeedDatePart(task);
  if (!evPart) return false;
  const target = parseYmdLocal(day) || new Date(day);
  const seed = parseYmdLocal(evPart) || new Date(evPart);
  if (isNaN(seed.getTime())) return false;
  const desiredDay = dayOfMonthFromYmdString(evPart) ?? seed.getDate();
  const desiredMonth = monthFromYmdString(evPart) ?? seed.getMonth() + 1;
  const y = target.getFullYear();
  const m = target.getMonth();
  if (m + 1 !== desiredMonth) return false;
  const daysInTargetMonth = new Date(y, m + 1, 0).getDate();
  const effectiveDay = Math.min(desiredDay, daysInTargetMonth);
  return effectiveDay === target.getDate();
}

function oneOffDateKey(task: Task): string | null {
  const ev: unknown =
    task.date ?? task.eventDate ?? (task as any).createdAt ?? (task as any).created_at ?? null;
  if (!ev) return null;
  if (ev instanceof Date) return formatYmdLocal(ev);
  if (typeof ev === 'string') return ev.indexOf('T') !== -1 ? (ev.split('T')[0] ?? ev) : ev;
  return null;
}

function computePrepTasksForToday(flatTasks: Task[], todayStr: string): Task[] {
  const todayDate = parseYmdLocal(todayStr);
  if (!todayDate) return [];
  const out: Task[] = [];
  for (const t of flatTasks) {
    if (t.type_id === 'Replenish') continue;
    const mode = (t as any).timeMode || 'event';
    if (Number(t.status_id) === 0 && mode !== 'prepare') continue;
    if (mode !== 'prepare' && mode !== 'expiration') continue;
    const ev = (t.date || t.eventDate) as string | undefined | null;
    if (!ev) continue;
    const evDate = parseYmdLocal(ev);
    if (!evDate) continue;
    const diffDays = Math.floor((evDate.getTime() - todayDate.getTime()) / MS_PER_DAY);
    const offset = getTimeOffsetDaysForTask(t);
    if (mode === 'prepare') {
      if (diffDays >= 0 && diffDays <= offset) out.push(t);
    } else if (diffDays <= offset) {
      out.push(t);
    }
  }
  return out;
}

export class TaskOccurrenceIndex {
  private dayWeek = new Map<string, Task[]>();
  private month: Task[] = [];
  private year: Task[] = [];
  private oneOffByDay = new Map<string, Task[]>();
  private occurrenceIdsByDay = new Map<string, Set<string>>();
  private occurrencesByDay = new Map<string, Task[]>();
  private taskById = new Map<string, Task>();
  private todos: Task[] = [];
  private prepTasksForToday: Task[] = [];
  private horizonStart = '';
  private horizonEnd = '';

  rebuild(
    flatTasks: Task[],
    extraDayKeys: string[] = [],
    daysMap: Record<string, { tasks?: Task[] }> = {},
  ): void {
    this.dayWeek.clear();
    this.month = [];
    this.year = [];
    this.oneOffByDay.clear();
    this.occurrenceIdsByDay.clear();
    this.occurrencesByDay.clear();
    this.taskById.clear();
    this.todos = [];
    this.prepTasksForToday = [];

    const today = todayString();
    let horizonStart = addDaysYmd(today, -HORIZON_PAST_DAYS);
    let horizonEnd = addDaysYmd(today, HORIZON_FUTURE_DAYS);
    for (const key of extraDayKeys) {
      if (!key) continue;
      if (key < horizonStart) horizonStart = key;
      if (key > horizonEnd) horizonEnd = key;
    }
    this.horizonStart = horizonStart;
    this.horizonEnd = horizonEnd;

    for (const task of flatTasks) {
      if (task.id != null) this.taskById.set(String(task.id), task);
      if (task.type_id === 'Todo') this.todos.push(task);

      const cycle = getCycleType(task);
      if (cycle === 'dayWeek') {
        const days = getRepeatDays(task) || [];
        const normalized = (days as unknown[])
          .map(normalizeRepeatWeekday)
          .filter((x: string | null): x is string => x != null);
        for (const key of normalized) {
          if (!this.dayWeek.has(key)) this.dayWeek.set(key, []);
          this.dayWeek.get(key)!.push(task);
        }
        continue;
      }
      if (cycle === 'month') {
        this.month.push(task);
        continue;
      }
      if (cycle === 'year') {
        this.year.push(task);
        continue;
      }
      if (cycle === 'other') {
        this.indexIntervalTask(task, horizonStart, horizonEnd);
        continue;
      }

      const dateKey = oneOffDateKey(task);
      if (dateKey) {
        if (!this.oneOffByDay.has(dateKey)) this.oneOffByDay.set(dateKey, []);
        this.oneOffByDay.get(dateKey)!.push(task);
      }
    }

    this.indexCyclicHorizon(horizonStart, horizonEnd);

    for (const key of Object.keys(daysMap)) {
      const bucket = daysMap[key]?.tasks;
      if (!Array.isArray(bucket)) continue;
      for (const task of bucket) {
        if (task?.id != null) this.taskById.set(String(task.id), task);
        this.addOccurrence(key, task);
      }
    }

    this.prepTasksForToday = computePrepTasksForToday(flatTasks, today);
  }

  private indexIntervalTask(task: Task, horizonStart: string, horizonEnd: string): void {
    const evPart = taskSeedDatePart(task);
    if (!evPart) return;
    const seed = parseYmdLocal(evPart);
    if (!seed) return;
    const rawInterval =
      Number(
        (task as any)?.repeat?.intervalDays ??
          (task as any)?.repeat?.interval_days ??
          (task as any).intervalDays ??
          (task as any).interval_days ??
          0,
      ) || 0;
    const interval = Math.max(0, Math.floor(rawInterval));
    if (interval <= 0) return;

    const end = parseYmdLocal(horizonEnd);
    if (!end) return;

    const cursor = new Date(seed.getTime());
    while (formatYmdLocal(cursor) <= horizonEnd) {
      const ymd = formatYmdLocal(cursor);
      if (ymd >= horizonStart) this.addOccurrence(ymd, task);
      cursor.setDate(cursor.getDate() + interval);
      if (cursor.getTime() > end.getTime()) break;
    }
  }

  private indexCyclicHorizon(horizonStart: string, horizonEnd: string): void {
    let cursor = horizonStart;
    while (cursor <= horizonEnd) {
      const weekday = weekdayKeyForDay(cursor);
      for (const task of this.dayWeek.get(weekday) ?? []) {
        this.addOccurrence(cursor, task);
      }
      for (const task of this.month) {
        if (monthOccursOnDay(task, cursor)) this.addOccurrence(cursor, task);
      }
      for (const task of this.year) {
        if (yearOccursOnDay(task, cursor)) this.addOccurrence(cursor, task);
      }
      cursor = addDaysYmd(cursor, 1);
    }

    for (const [day, tasks] of this.oneOffByDay) {
      for (const task of tasks) this.addOccurrence(day, task);
    }
  }

  private addOccurrence(day: string, task: Task): void {
    if (task.id == null) return;
    const id = String(task.id);
    if (!this.occurrenceIdsByDay.has(day)) {
      this.occurrenceIdsByDay.set(day, new Set());
      this.occurrencesByDay.set(day, []);
    }
    const ids = this.occurrenceIdsByDay.get(day)!;
    if (ids.has(id)) return;
    ids.add(id);
    this.occurrencesByDay.get(day)!.push(task);
  }

  hasIndexedDay(day: string): boolean {
    return day >= this.horizonStart && day <= this.horizonEnd;
  }

  getOccurrenceIdSet(day: string): ReadonlySet<string> {
    return this.occurrenceIdsByDay.get(day) ?? new Set();
  }

  getTaskById(id: string): Task | undefined {
    return this.taskById.get(String(id));
  }

  taskOccursOnDay(task: Task, day: string): boolean {
    if (!getCycleType(task)) {
      const key = oneOffDateKey(task);
      return key === day;
    }
    if (this.hasIndexedDay(day) && task.id != null) {
      return this.occurrenceIdsByDay.get(day)?.has(String(task.id)) ?? false;
    }
    return occursOnDay(task, day);
  }

  getTodoTasks(): Task[] {
    return this.todos;
  }

  getPrepTasksForToday(): Task[] {
    return this.prepTasksForToday;
  }

  /** O(1) lookup — tasks that occur on `day` (caller applies status/type filters). */
  getOccurrencesForDay(day: string): Task[] {
    if (!this.hasIndexedDay(day)) {
      const out: Task[] = [];
      for (const t of this.taskById.values()) {
        if (occursOnDay(t, day)) out.push(t);
      }
      return out;
    }
    return this.occurrencesByDay.get(day) ?? [];
  }
}

export const taskOccurrenceIndex = new TaskOccurrenceIndex();
