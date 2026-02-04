import { computed } from 'vue';
import logger from 'src/utils/logger';
import type { Ref } from 'vue';
import type { Task } from 'src/modules/task/types';

export function createTaskComputed(args: {
  currentDayData: Ref<{ tasks: Task[] }>;
  currentDate: Ref<string>;
  allTasks: Ref<Task[]>;
  getTasksInRange?: (from: string, to: string) => Task[];
  groups: Ref<any[]>;
  activeGroup: Ref<any>;
  getGroupsByParent: (parent?: string) => any[];
  parseYmdLocal: (s: string) => Date | null;
  getTimeOffsetDaysForTask: (t: any) => number;
  getCycleType: (t: any) => any;
  occursOnDay: (t: any, day: string) => boolean;
  groupIsVisible: (groups: any, activeGroup: any, candidateId: any) => boolean;
}) {
  const {
    currentDayData,
    currentDate,
    allTasks,
    getTasksInRange,
    groups,
    activeGroup,
    getGroupsByParent,
    parseYmdLocal,
    getTimeOffsetDaysForTask,
    getCycleType,
    occursOnDay,
    groupIsVisible,
  } = args;

  const sortedTasks = computed(() => {
    let tasksToSort = currentDayData.value.tasks.slice();

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      if (currentDate.value === todayStr && typeof getTasksInRange === 'function') {
        const all = getTasksInRange('1970-01-01', '9999-12-31');
        const todoExtras = all.filter((t) => t.type_id === 'Todo');
        for (const t of todoExtras) {
          if (!tasksToSort.some((existing) => existing.id === t.id)) {
            tasksToSort.push(t);
          }
        }
        try {
          const prepExtras = all.filter((t) => {
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
            if (mode === 'prepare') {
              return diffDays >= 0 && diffDays <= offset;
            }
            return diffDays <= offset;
          });
          for (const t of prepExtras) {
            if (!tasksToSort.some((existing) => existing.id === t.id)) tasksToSort.push(t);
          }
        } catch (e) {
          // ignore
        }
      }
    } catch (err) {
      logger.warn('Failed to include Todo extras for today', err);
    }

    const isVisibleForActive = (candidateId: any) =>
      groupIsVisible(groups.value, activeGroup.value, candidateId);

    try {
      const dayStr = currentDate.value;
      const isCyclicNotOccurring = (task: any) => {
        const cycle = getCycleType(task);
        if (!cycle) return false;
        try {
          const occurs = occursOnDay(task, dayStr);
          return !occurs;
        } catch (err) {
          return false;
        }
      };

      tasksToSort = tasksToSort.filter((t) => !isCyclicNotOccurring(t));
    } catch (e) {
      // ignore
    }

    try {
      const full = allTasks.value || [];
      const day = currentDate.value;

      for (const t of full) {
        if (Number(t.status_id) === 0) continue;
        if (t.type_id === 'Replenish') continue;
        if (occursOnDay(t, day)) {
          if (!tasksToSort.some((existing) => existing.id === t.id)) {
            const clone: any = { ...t, eventDate: day };
            clone.__isCyclicInstance = true;
            if (isVisibleForActive(clone.groupId)) tasksToSort.push(clone);
          }
        }
      }
      tasksToSort = tasksToSort.filter((task) => isVisibleForActive(task.groupId));
    } catch (e) {
      // ignore errors here
    }

    const val = [...tasksToSort].sort((a, b) => {
      const hasTimeA = !!a.eventTime;
      const hasTimeB = !!b.eventTime;
      if (hasTimeA && !hasTimeB) return -1;
      if (!hasTimeA && hasTimeB) return 1;
      if (hasTimeA && hasTimeB) return a.eventTime!.localeCompare(b.eventTime!);
      const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      const priorityCompare = (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99);
      if (priorityCompare !== 0) return priorityCompare;
      return 0;
    });
    return val;
  });

  const replenishTasks = computed(() => {
    try {
      const all = allTasks.value || [];
      let val = all.filter((t) => t.type_id === 'Replenish' && Number(t.status_id) !== 0);
      if (activeGroup.value && activeGroup.value.value !== null) {
        val = val.filter((t) => groupIsVisible(groups.value, activeGroup.value, t.groupId));
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
        const base = (allTasks.value || []).find((x: any) => x.id === t.id) || t;
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
        (t: any) => t.type_id === 'Replenish' && Number(t.status_id) === 0,
      );
      if (activeGroup.value && activeGroup.value.value !== null) {
        replenishDone = replenishDone.filter((t: any) =>
          groupIsVisible(groups.value, activeGroup.value, t.groupId),
        );
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

  const tasksWithTime = computed(() => {
    const day = currentDate.value;
    const val = sortedTasks.value.filter((t) => {
      if (t.type_id === 'Replenish') return false;
      try {
        const base = (allTasks.value || []).find((x: any) => x.id === t.id) || t;
        const mode = (t && t.timeMode) || (base && base.timeMode) || 'event';
        if (Number(t.status_id) === 0 && mode !== 'prepare') return false;
      } catch (e) {
        // ignore
      }
      try {
        const cycle = getCycleType(t);
        if (cycle) {
          const base = (allTasks.value || []).find((x: any) => x.id === t.id) || t;
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
        const mode = t.timeMode || 'event';
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
      return !!t.eventTime;
    });
    return val;
  });

  const tasksWithoutTime = computed(() => {
    const day = currentDate.value;
    const val = sortedTasks.value.filter((t) => {
      if (t.type_id === 'Replenish') return false;
      try {
        const base = (allTasks.value || []).find((x: any) => x.id === t.id) || t;
        const mode = (t && t.timeMode) || (base && base.timeMode) || 'event';
        if (Number(t.status_id) === 0 && mode !== 'prepare') return false;
      } catch (e) {
        // ignore
      }
      try {
        const cycle = getCycleType(t);
        if (cycle) {
          const base = (allTasks.value || []).find((x: any) => x.id === t.id) || t;
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
        const mode = t.timeMode || 'event';
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
      return !t.eventTime;
    });
    return val;
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
        flat.push({ label: `${'\u00A0'.repeat(depth * 2)}${g.name}`, value: String(g.id) });
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
        const taskCount = all.filter((t) => t.groupId === g.id).length;
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
      return groupsForParent.map((group) => ({
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
