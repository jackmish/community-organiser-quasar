import { computed, ref } from 'vue';
import logger from 'src/utils/logger';
import {
  occursOnDay as utilOccursOnDay,
  getCycleType as utilGetCycleType,
  getRepeatDays as utilGetRepeatDays,
} from '../utils/occursOnDay';
import {
  parseYmdLocal as parseYmdLocalDefault,
  todayString,
  getTimeOffsetDaysForTask as getTimeOffsetDaysDefault,
} from 'src/utils/dateUtils';
import type { Ref } from 'vue';
import type { Task } from 'src/modules/task/models/TaskModel';
import { isMediaTaskTypeId } from 'src/modules/media/mediaTaskTypes';
import { isNoteTaskType } from '../utils/calendarTaskTypes';

export function createTaskComputed(args: {
  currentDayData: Ref<{ tasks: Task[] }>;
  currentDate: Ref<string>;
  allTasks: Ref<Task[]>;
  task?: any;
  group?: any;
}) {
  const { currentDayData, currentDate, allTasks, task, group } = args;

  // Derive helpers from provided APIs (prefer task/group). Provide
  // minimal safe fallbacks so this module remains usable in tests.
  const parseYmdLocal = task?.helpers?.parseYmdLocal ?? parseYmdLocalDefault;
  const getTimeOffsetDaysForTask =
    task?.helpers?.getTimeOffsetDaysForTask ?? getTimeOffsetDaysDefault;

  const getCycleType = task?.helpers?.getCycleType ?? utilGetCycleType;
  const getRepeatDays = task?.helpers?.getRepeatDays ?? utilGetRepeatDays;
  const getOccurrencesForDay: (day: string) => Task[] = task?.list?.occurrencesForDay
    ? (day: string) => task.list.occurrencesForDay(day)
    : (day: string) => (allTasks.value || []).filter((t) => utilOccursOnDay(t, day));
  const getIndexedTodos: () => Task[] = task?.list?.todos
    ? () => task.list.todos()
    : () => (allTasks.value || []).filter((t) => t.type_id === 'Todo');
  const getPrepTasksForToday: () => Task[] = task?.list?.prepTasksForToday
    ? () => task.list.prepTasksForToday()
    : () => {
        const todayStr = todayString();
        const flat = allTasks.value || [];
        return flat.filter((t) => {
          if (t.type_id === 'Replenish') return false;
          const mode = (t as any).timeMode || 'event';
          if (Number(t.status_id) === 0 && mode !== 'prepare') return false;
          if (mode !== 'prepare' && mode !== 'expiration') return false;
          const ev = (t.date || t.eventDate) as string | undefined | null;
          if (!ev) return false;
          const evDate = parseYmdLocal(ev);
          const todayDate = parseYmdLocal(todayStr);
          if (!evDate || !todayDate) return false;
          const msPerDay = 1000 * 60 * 60 * 24;
          const diffDays = Math.floor((evDate.getTime() - todayDate.getTime()) / msPerDay);
          const offset = getTimeOffsetDaysForTask(t);
          if (mode === 'prepare') return diffDays >= 0 && diffDays <= offset;
          return diffDays <= offset;
        });
      };
  const resolveTaskById = (id: string | number | undefined): Task | undefined => {
    if (id == null) return undefined;
    if (task?.list?.taskById) return task.list.taskById(String(id));
    return (allTasks.value || []).find((x) => String(x.id) === String(id));
  };
  const getOccurrenceIdsForDay = (day: string): ReadonlySet<string> => {
    if (task?.taskRepo?.getOccurrenceIdSetForDay) {
      return task.taskRepo.getOccurrenceIdSetForDay(day);
    }
    const ids = new Set<string>();
    for (const t of allTasks.value || []) {
      if (t.id != null && utilOccursOnDay(t, day)) ids.add(String(t.id));
    }
    return ids;
  };

  function taskGroupId(task: { groupId?: string; group_id?: string } | null | undefined): string {
    return String(task?.groupId ?? (task as any)?.group_id ?? '');
  }

  function cyclicSeriesKey(task: {
    groupId?: string;
    group_id?: string;
    name?: string;
    repeat?: unknown;
  }): string | null {
    const cycle = getCycleType(task);
    if (!cycle) return null;
    const days = getRepeatDays(task);
    const daysKey = Array.isArray(days) ? [...days].sort().join(',') : '';
    const gid = taskGroupId(task);
    const name = String(task.name || '').trim().toLowerCase();
    return `${gid}|${name}|${cycle}|${daysKey}`;
  }

  const groups: Ref<any[]> = (group?.list?.all as Ref<any[]>) ?? ref([] as any[]);
  const activeGroup: Ref<any> = (group?.active?.activeGroup as Ref<any>) ?? ref(null as any);
  const getGroupsByParent = group?.list
    ? (p?: string) => group.list.getGroupsByParent(p)
    : (p?: string) => [] as any[];
  const rawGroupIsVisible = group?.list
    ? (candidateId: any) => group.list.isVisibleForActive(candidateId)
    : undefined;

  // Normalize the group visibility helper so callers can always use a single-arg
  // function `isVisibleForActive(candidateId)` that returns boolean. This adapts
  // both bound 1-arg helpers and 3-arg helpers from older APIs.
  const isVisibleForActive: (candidateId: any) => boolean = (() => {
    if (typeof rawGroupIsVisible === 'function') {
      return (candidateId: any) => rawGroupIsVisible(candidateId);
    }
    return (candidateId: any) => true;
  })();

  const sortedTasks = computed(() => {
    let tasksToSort = currentDayData.value.tasks.slice();
    const listedIds = new Set<string | number>();
    const listedSeries = new Set<string>();
    for (const t of tasksToSort) {
      if (t.id != null) listedIds.add(t.id);
      const sk = cyclicSeriesKey(t);
      if (sk) listedSeries.add(sk);
    }

    try {
      for (const t of getIndexedTodos()) {
        if (t.id != null && !listedIds.has(t.id)) {
          tasksToSort.push(t);
          listedIds.add(t.id);
        }
      }
      const todayStr = todayString();
      if (currentDate.value === todayStr) {
        for (const t of getPrepTasksForToday()) {
          if (t.id != null && !listedIds.has(t.id)) {
            tasksToSort.push(t);
            listedIds.add(t.id);
          }
        }
      }
    } catch (err) {
      logger.warn('Failed to include Todo extras for today', err);
    }

    try {
      const dayStr = currentDate.value;
      const occurringIds = getOccurrenceIdsForDay(dayStr);
      tasksToSort = tasksToSort.filter((t) => {
        const cycle = getCycleType(t);
        if (!cycle) return true;
        return t.id != null && occurringIds.has(String(t.id));
      });
    } catch (e) {
      // ignore
    }

    try {
      const day = currentDate.value;
      const candidates = getOccurrencesForDay(day);

      for (const t of candidates) {
        if (Number(t.status_id) === 0) continue;
        if (isMediaTaskTypeId(String(t.type_id || ''))) continue;
        if (t.type_id === 'Replenish') continue;
        if (isNoteTaskType(t)) continue;
        if (t.id != null && listedIds.has(t.id)) continue;
        const seriesKey = cyclicSeriesKey(t);
        if (seriesKey != null && listedSeries.has(seriesKey)) continue;
        const clone: any = { ...t, eventDate: day, date: day };
        clone.__isCyclicInstance = true;
        if (isVisibleForActive(taskGroupId(clone))) {
          tasksToSort.push(clone);
          if (clone.id != null) listedIds.add(clone.id);
          if (seriesKey) listedSeries.add(seriesKey);
        }
      }
      tasksToSort = tasksToSort.filter((task) => isVisibleForActive(taskGroupId(task)));
      tasksToSort = tasksToSort.filter((task) => !isMediaTaskTypeId(String(task.type_id || '')));
    } catch (e) {
      // ignore errors here
    }

    const val = [...tasksToSort].sort((a, b) => {
      const hasTimeA = !!a.eventTime;
      const hasTimeB = !!b.eventTime;
      if (hasTimeA && !hasTimeB) return -1;
      if (!hasTimeA && hasTimeB) return 1;
      if (hasTimeA && hasTimeB) return String(a.eventTime).localeCompare(String(b.eventTime));
      const priorityOrder: Record<string, number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
      };
      const priorityCompare = (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99);
      if (priorityCompare !== 0) return priorityCompare;
      return 0;
    });
    return val;
  });

  const replenishTasks = computed(() => {
    try {
      const all = allTasks.value || [];
      let val = all.filter(
        (t) => (t.type_id || t.type) === 'Replenish' && Number(t.status_id) !== 0,
      );
      if (activeGroup.value && activeGroup.value.value !== null) {
        val = val.filter((t) => isVisibleForActive(taskGroupId(t as any)));
      }
      val = val.sort((a: any, b: any) => {
        const na = (a.name || '').toLowerCase();
        const nb = (b.name || '').toLowerCase();
        if (na < nb) return -1;
        if (na > nb) return 1;
        return 0;
      });
      return val;
    } catch (e) {
      return [];
    }
  });

  const doneTasks = computed(() => {
    const day = currentDate.value;
    const done = sortedTasks.value.filter((t) => {
      try {
        const base = resolveTaskById(t.id) || t;
        const mode = (t && t.timeMode) || (base && base.timeMode) || 'event';
        if (mode === 'prepare') return false;
        if (Number(t.status_id) === 0) return true;
        const cycle = getCycleType(t);
        if (!cycle) return false;
        const hist = (base as any).history || [];
        return hist.some((h: any) => h && h.type === 'cycleDone' && h.date === day);
      } catch (e) {
        return false;
      }
    });

    try {
      const all = allTasks.value || [];
      let replenishDone = all.filter(
        (t: any) => (t.type_id || t.type) === 'Replenish' && Number(t.status_id) === 0,
      );
      if (activeGroup.value && activeGroup.value.value !== null) {
        replenishDone = replenishDone.filter((t: any) => isVisibleForActive(taskGroupId(t)));
      }
      const existingIds = new Set(done.map((d: any) => d.id));
      for (const r of replenishDone) {
        if (!existingIds.has(r.id)) done.push(r);
      }
    } catch (e) {
      // ignore
    }

    return [...done].sort((a, b) => {
      const getTime = (task: any) => {
        const ts = task.updatedAt ?? task.createdAt ?? task.updated_at ?? task.created_at ?? null;
        return ts ? new Date(ts).getTime() : 0;
      };
      const hasStar = (task: any) => {
        try {
          const desc = (task && task.description) || '';
          return desc.split(/\r?\n/).some((l: string) => /\*\s*$/.test(l));
        } catch (e) {
          return false;
        }
      };
      const wa = hasStar(a) ? 1 : 0;
      const wb = hasStar(b) ? 1 : 0;
      if (wa !== wb) return wb - wa;
      return getTime(b) - getTime(a);
    });
  });

  /**
   * Shared predicate for both tasksWithTime and tasksWithoutTime.
   * Returns false if the task should be hidden from the active day's lists
   * (completed, cycled-done, or outside its prepare/expiration window).
   */
  function isActiveForDay(t: Task, day: string): boolean {
    if (t.type_id === 'Replenish') return false;
    if (isNoteTaskType(t)) return false;
    try {
      const base = resolveTaskById(t.id) || t;
      const mode = (t && t.timeMode) || (base && base.timeMode) || 'event';
      if (Number(t.status_id) === 0 && mode !== 'prepare') return false;
    } catch (e) {
      // ignore
    }
    try {
      const cycle = getCycleType(t);
      if (cycle) {
        const base = resolveTaskById(t.id) || t;
        const hist = (base as any).history || [];
        if (
          Array.isArray(hist) &&
          hist.some((h: any) => h && h.type === 'cycleDone' && h.date === day)
        )
          return false;
      }
    } catch (e) {
      // ignore
    }
    try {
      const mode = (t as any).timeMode || 'event';
      if (mode === 'prepare' || mode === 'expiration') {
        const ev = (t.date || t.eventDate) as string | undefined | null;
        if (!ev) return false;
        const offset = getTimeOffsetDaysForTask(t);
        const msPerDay = 1000 * 60 * 60 * 24;
        const evDate = parseYmdLocal(ev);
        const thisDate = parseYmdLocal(day);
        if (!evDate || !thisDate) return false;
        const diffDays = Math.floor((evDate.getTime() - thisDate.getTime()) / msPerDay);
        if (mode === 'prepare') {
          if (!(diffDays >= 0 && diffDays <= offset)) return false;
        } else if (mode === 'expiration') {
          if (!(diffDays <= offset)) return false;
        }
      }
    } catch (e) {
      // ignore and fall back
    }
    return true;
  }

  const tasksWithTime = computed(() => {
    const day = currentDate.value;
    return sortedTasks.value.filter((t) => isActiveForDay(t, day) && !!t.eventTime);
  });

  const tasksWithoutTime = computed(() => {
    const day = currentDate.value;
    return sortedTasks.value.filter((t) => isActiveForDay(t, day) && !t.eventTime);
  });

  const groupOptions = computed(() => {
    const byParent: Record<string, any[]> = {};
    (groups.value || []).forEach((g) => {
      const key = g.parentId ?? g.parent_id ?? '__root__';
      if (!byParent[key]) byParent[key] = [];
      byParent[key].push(g);
    });

    const flat: any[] = [];
    const walk = (parentKey: string, depth = 0) => {
      const list = byParent[parentKey] || [];
      list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
      list.forEach((g) => {
        flat.push({
          label: `${'\u00A0'.repeat(depth * 2)}${g.name}`,
          value: String(g.id),
        });
        walk(g.id, depth + 1);
      });
    };

    walk('__root__', 0);
    return flat;
  });

  const activeGroupOptions = computed(() => {
    const all = currentDayData.value.tasks;
    const totalTaskCount = all.length;
    const options = [
      {
        label: `All Groups (${totalTaskCount})`,
        value: null,
      },
      ...groups.value.map((g) => {
        const taskCount = all.filter((t: any) => taskGroupId(t) === String(g.id)).length;
        return { label: `${g.name} (${taskCount})`, value: String(g.id) };
      }),
    ];

    return options;
  });

  const groupTree = computed(() => {
    const buildTree = (parentId?: string): any[] => {
      const pidNorm = parentId == null ? undefined : String(parentId);
      const groupsForParent = getGroupsByParent(pidNorm);
      try {
        logger.debug('[DayOrganiserPage] buildTree parent=', pidNorm, parentId);
      } catch (e) {
        // ignore
      }
      return groupsForParent.map((group: any) => ({
        id: String(group.id),
        label: group.name,
        color: group.color,
        icon: group.icon || 'folder',
        group: group,
        children: buildTree(String(group.id)),
      }));
    };
    return buildTree();
  });

  return {
    sortedTasks,
    replenishTasks,
    doneTasks,
    tasksWithTime,
    tasksWithoutTime,
    groupOptions,
    activeGroupOptions,
    groupTree,
  } as const;
}
