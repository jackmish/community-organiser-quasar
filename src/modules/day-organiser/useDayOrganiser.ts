import { ref, computed } from 'vue';
import { getCycleType } from '../../utils/occursOnDay';
import type { OrganiserData, DayData, Task, TaskGroup } from './types';
import { storage } from './storage';
import { generateGroupId } from './groupId';
import logger from 'src/utils/logger';

// Generate unique ID
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Format date to YYYY-MM-DD
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0] ?? '';
};

// Create a sanitized snapshot suitable for history entries.
// This avoids storing reactive proxies or circular structures which break JSON.stringify.
function sanitizeForHistory(value: any) {
  if (value === null || value === undefined) return value;
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return value;
  if (t === 'function') return '[Function]';
  if (value instanceof Date) return value.toISOString();
  // For objects/arrays, produce a shallow serializable summary and avoid deep traversal
  try {
    if (Array.isArray(value)) {
      return value.map((v) => (typeof v === 'object' && v !== null ? '[Object]' : v));
    }
    const out: any = {};
    for (const k of Object.keys(value)) {
      try {
        const v = value[k];
        if (v === null || v === undefined) {
          out[k] = v;
        } else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
          out[k] = v;
        } else if (v instanceof Date) {
          out[k] = v.toISOString();
        } else if (Array.isArray(v)) {
          out[k] = '[Array]';
        } else if (typeof v === 'function') {
          out[k] = '[Function]';
        } else {
          out[k] = '[Object]';
        }
      } catch (e) {
        out[k] = '[Unserializable]';
      }
    }
    return out;
  } catch (e) {
    return '[Unserializable]';
  }
}

// Reactive state
const organiserData = ref<OrganiserData>({
  days: {},
  groups: [],
  lastModified: new Date().toISOString(),
});

const isLoading = ref(false);
const currentDate = ref(formatDate(new Date()));
// Optional preview request: a component can request a task preview by id
const previewTaskId = ref<string | null>(null);
// Optional preview payload: may include occurrence date for cyclic tasks
const previewTaskPayload = ref<Record<string, unknown> | null>(null);
// Shared active group selection across pages/components
const activeGroup = ref<{ label: string; value: string | null } | null>(null);

export function useDayOrganiser() {
  // Load data from storage
  const loadData = async () => {
    isLoading.value = true;
    try {
      const data = await storage.loadData();

      // If storage returned groups with tasks, reconstruct days mapping
      const daysMap: Record<string, DayData> = {};
      if (Array.isArray((data as any).groups)) {
        for (const grp of (data as any).groups) {
          if (Array.isArray(grp.tasks)) {
            for (const t of grp.tasks) {
              // Prefer explicit date field, fall back to eventDate if present
              const dateKey = t.date || t.eventDate || formatDate(new Date());
              if (!daysMap[dateKey]) {
                daysMap[dateKey] = { date: dateKey, tasks: [], notes: '' };
              }
              // Ensure task has groupId set
              if (!t.groupId) t.groupId = grp.id;
              daysMap[dateKey].tasks.push(t);
            }
          }
        }
      }

      // NOTE: legacy task form/data is no longer migrated here; stored tasks must use the
      // canonical `repeat` object. Older formats will be ignored.

      // Ensure stored groups remain a flat list without nested `children` or `tasks` properties.
      const rawGroups = Array.isArray((data as any).groups) ? (data as any).groups : [];
      // const sanitizedGroups = rawGroups.map((g: any) => {
      //   const copy: any = { ...g };
      //   // normalize snake_case parent_id to camelCase parentId
      //   if (copy.parent_id !== undefined && copy.parentId === undefined) {
      //     copy.parentId = copy.parent_id;
      //     delete copy.parent_id;
      //   }
      //   if ('children' in copy) delete copy.children;
      //   if ('tasks' in copy) delete copy.tasks;
      //   return copy;
      // });

      organiserData.value = {
        days: Object.keys(daysMap).length ? daysMap : (data as any).days || {},
        groups: rawGroups,
        lastModified: (data as any).lastModified || new Date().toISOString(),
      };

      // If no activeGroup was set previously, default to the first group (if any)
      try {
        const grpList = organiserData.value.groups || [];
        if (
          (!activeGroup.value || activeGroup.value === null) &&
          Array.isArray(grpList) &&
          grpList.length > 0
        ) {
          const fg = grpList[0];
          if (fg) {
            const fid = (fg as any).id;
            const fname = (fg as any).name || String(fid);
            activeGroup.value = { label: fname, value: fid };
          }
        }
      } catch (e) {
        // ignore
      }

      const dirPath = await storage.getDataFilePathPublic();
    } catch (error) {
      logger.error('Failed to load data:', error);
    } finally {
      isLoading.value = false;
    }
  };

  // Save data to storage
  const saveData = async () => {
    try {
      // Persist organiserData as-is; do not mutate group objects here.
      await storage.saveData(organiserData.value as OrganiserData);
    } catch (error) {
      logger.error('Failed to save data:', error);
      throw error;
    }
  };

  // Get day data for a specific date
  const getDayData = (date: string): DayData => {
    if (!organiserData.value.days[date]) {
      organiserData.value.days[date] = {
        date,
        tasks: [],
        notes: '',
      };
    }
    return organiserData.value.days[date];
  };

  // Current day data
  const currentDayData = computed(() => getDayData(currentDate.value));

  // Add a new task
  const addTask = async (
    date: string,
    taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Task> => {
    const now = new Date().toISOString();
    const task: Task = {
      ...taskData,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };

    // Ensure cyclic tasks remain with non-zero status
    try {
      const isCyclic = Boolean(getCycleType(task));
      if (isCyclic) {
        (task as any).status_id = 1;
      }
    } catch (e) {
      // ignore
    }

    const dayData = getDayData(date);
    dayData.tasks.push(task);

    // Tasks are stored under `days`; do not nest tasks inside group objects here.

    await saveData();
    return task;
  };

  // Update a task
  const updateTask = async (
    date: string,
    taskId: string,
    updates: Partial<Omit<Task, 'id' | 'createdAt'>>,
  ): Promise<void> => {
    const dayData = getDayData(date);
    let task = dayData.tasks.find((t) => t.id === taskId);

    // If task not in this date bucket (e.g. a generated cyclic instance), find it across all days
    if (!task) {
      for (const dKey of Object.keys(organiserData.value.days)) {
        const d = organiserData.value.days[dKey];
        if (!d || !Array.isArray(d.tasks)) continue;
        const found = d.tasks.find((t) => t.id === taskId);
        if (found) {
          task = found;
          break;
        }
      }
    }

    if (!task) {
      throw new Error('Task not found');
    }

    // Prepare history array
    if (!Array.isArray((task as any).history)) (task as any).history = [];

    // Handle cyclic tasks specially: marking as done should not change base status
    const isCyclic = Boolean(getCycleType(task));
    if (Object.prototype.hasOwnProperty.call(updates, 'status_id')) {
      const newStatus = Number((updates as any).status_id);
      if (isCyclic && newStatus === 0) {
        // Record a cycleDone history entry for the occurrence `date` instead of setting status to done
        (task as any).history.push({
          type: 'cycleDone',
          is_done: true,
          date: date,
          changedAt: new Date().toISOString(),
        });
        // remove status_id from updates to avoid marking task done
        delete (updates as any).status_id;
      }
    }

    // For other updates, record field-level history entries when values change
    Object.keys(updates).forEach((k) => {
      try {
        const key = k as keyof typeof task;
        const oldVal = (task as any)[key];
        const newVal = (updates as any)[key];
        if (oldVal !== newVal) {
          (task as any).history.push({
            type: 'update',
            field: key,
            old: sanitizeForHistory(oldVal),
            new: sanitizeForHistory(newVal),
            changedAt: new Date().toISOString(),
          });
        }
      } catch (e) {
        // ignore
      }
    });

    Object.assign(task, updates, {
      updatedAt: new Date().toISOString(),
    });

    // Do not mutate group objects to store task copies; tasks are canonical in `days`.

    await saveData();
  };

  // Delete a task
  const deleteTask = async (date: string, taskId: string): Promise<void> => {
    const dayData = getDayData(date);
    dayData.tasks = dayData.tasks.filter((t) => t.id !== taskId);

    // Tasks are stored in days; no nested group task cleanup required.

    await saveData();
  };

  // Toggle task completion
  const toggleTaskComplete = async (date: string, taskId: string): Promise<void> => {
    const dayData = getDayData(date);
    let task = dayData.tasks.find((t) => t.id === taskId);
    // Debug logging to help trace toggle attempts across dates
    try {
      logger.debug(
        '[toggleTaskComplete] date=',
        date,
        'taskId=',
        taskId,
        'foundInBucket=',
        Boolean(task),
      );
    } catch (e) {
      // ignore
    }

    // If not found in this date bucket, look across all days (cyclic occurrences may be generated)
    if (!task) {
      for (const dKey of Object.keys(organiserData.value.days)) {
        const d = organiserData.value.days[dKey];
        if (!d || !Array.isArray(d.tasks)) continue;
        const found = d.tasks.find((t) => t.id === taskId);
        if (found) {
          task = found;
          break;
        }
      }
    }

    if (task) {
      // Flip status_id between 0 (done) and 1 (just created)
      try {
        const cur = Number((task as any).status_id);
        const next = cur === 0 ? 1 : 0;
        const isCyclic = Boolean(getCycleType(task));
        if (isCyclic && next === 0) {
          // For cyclic tasks, record a history entry rather than setting base status
          if (!Array.isArray((task as any).history)) (task as any).history = [];
          (task as any).history.push({
            type: 'cycleDone',
            is_done: true,
            date: date,
            changedAt: new Date().toISOString(),
          });
          // Debug: log after adding history
          try {
            logger.debug('[toggleTaskComplete] added cycleDone', {
              date,
              taskId,
              historyLen: (task as any).history.length,
            });
          } catch (e) {
            // ignore
          }
        } else {
          (task as any).status_id = next;
        }
      } catch (e) {
        (task as any).status_id = 1;
      }
      task.updatedAt = new Date().toISOString();
      await saveData();
      try {
        // Debug: log after save
        logger.debug('[toggleTaskComplete] saveData complete for taskId=', taskId, 'date=', date);
      } catch (e) {
        // ignore
      }
    }
  };

  // Update day notes
  const updateDayNotes = async (date: string, notes: string): Promise<void> => {
    const dayData = getDayData(date);
    dayData.notes = notes;
    await saveData();
  };

  // Get tasks for a date range
  const getTasksInRange = (startDate: string, endDate: string): Task[] => {
    const tasks: Task[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    Object.keys(organiserData.value.days).forEach((date) => {
      const current = new Date(date);
      if (current >= start && current <= end) {
        const dayTasks = organiserData.value.days[date]?.tasks;
        if (dayTasks) {
          tasks.push(...dayTasks);
        }
      }
    });

    return tasks.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.priority.localeCompare(b.priority);
    });
  };

  // Get tasks by category
  const getTasksByCategory = (category: Task['category']): Task[] => {
    const tasks: Task[] = [];
    Object.values(organiserData.value.days).forEach((day) => {
      tasks.push(...day.tasks.filter((t) => t.category === category));
    });
    return tasks;
  };

  // Get tasks by priority
  const getTasksByPriority = (priority: Task['priority']): Task[] => {
    const tasks: Task[] = [];
    Object.values(organiserData.value.days).forEach((day) => {
      tasks.push(...day.tasks.filter((t) => t.priority === priority));
    });
    return tasks;
  };

  // Get incomplete tasks
  const getIncompleteTasks = (): Task[] => {
    const tasks: Task[] = [];
    Object.values(organiserData.value.days).forEach((day) => {
      tasks.push(...day.tasks.filter((t) => Number((t as any).status_id) !== 0));
    });
    return tasks.sort((a, b) => a.date.localeCompare(b.date));
  };

  // Export data
  const exportData = () => {
    storage.exportToFile(organiserData.value);
  };

  // Import data
  const importData = async (file: File) => {
    try {
      const data = await storage.importFromFile(file);
      // Preserve imported data shape exactly; do not normalize or remove fields.
      organiserData.value = data;
      await saveData();
    } catch (error) {
      logger.error('Failed to import data:', error);
      throw error;
    }
  };

  // Set current date
  const setCurrentDate = (date: string | number | null) => {
    if (date && typeof date === 'string') {
      currentDate.value = date;
    }
  };

  // Navigate to today
  const goToToday = () => {
    currentDate.value = formatDate(new Date());
  };

  // Navigate to next day
  const nextDay = () => {
    const date = new Date(currentDate.value);
    date.setDate(date.getDate() + 1);
    currentDate.value = formatDate(date);
  };

  // Navigate to previous day
  const prevDay = () => {
    const date = new Date(currentDate.value);
    date.setDate(date.getDate() - 1);
    currentDate.value = formatDate(date);
  };

  // Undo a cycleDone history entry for a specific task/date.
  // Returns true if an entry was removed and data saved.
  const undoCycleDone = async (date: string, taskId: string): Promise<boolean> => {
    try {
      for (const dayKey of Object.keys(organiserData.value.days)) {
        const day = organiserData.value.days[dayKey];
        if (!day || !Array.isArray(day.tasks)) continue;
        const task = day.tasks.find((t: any) => t.id === taskId);
        if (task) {
          if (!Array.isArray((task as any).history)) return false;
          const before = (task as any).history.length;
          (task as any).history = (task as any).history.filter(
            (h: any) => !(h && h.type === 'cycleDone' && h.date === date),
          );
          const after = (task as any).history.length;
          if (after < before) {
            task.updatedAt = new Date().toISOString();
            await saveData();
            return true;
          }
          return false;
        }
      }
    } catch (err) {
      logger.error('undoCycleDone failed', err);
    }
    return false;
  };
  // Add group management helpers
  const addGroup = async (
    name: string,
    parentId?: string,
    color?: string,
    icon?: string,
    shareSubgroups?: boolean,
  ): Promise<TaskGroup> => {
    const now = new Date().toISOString();
    const group: TaskGroup = {
      id: generateGroupId(name),
      name,
      createdAt: now,
      ...(parentId && { parentId }),
      ...(color && { color }),
      ...(icon && { icon }),
      ...(typeof shareSubgroups === 'boolean' ? { shareSubgroups } : {}),
    };

    organiserData.value.groups.push(group);
    // Save using storage.ts logic (handles Electron and browser)
    await saveData();
    return group;
  };

  const updateGroup = async (
    groupId: string,
    updates: Partial<Omit<TaskGroup, 'id' | 'createdAt'>>,
  ): Promise<void> => {
    const group = organiserData.value.groups.find((g) => g.id === groupId);
    if (!group) {
      throw new Error('Group not found');
    }
    Object.assign(group, updates);
    await saveData();
  };

  const deleteGroup = async (groupId: string): Promise<void> => {
    const groupToDelete = organiserData.value.groups.find((g) => g.id === groupId);

    // Remove group
    organiserData.value.groups = organiserData.value.groups.filter((g) => g.id !== groupId);

    // Remove groupId from all tasks
    Object.values(organiserData.value.days).forEach((day) => {
      day.tasks.forEach((task) => {
        if (task.groupId === groupId) {
          delete task.groupId;
        }
      });
    });

    // Move child groups to parent or root
    const normalizeId = (v: any): string | null => {
      if (v === null || v === undefined) return null;
      // If it's an object like { label, value } or { id }, prefer .value then .id
      if (typeof v === 'object') {
        const maybe = v.value ?? v.id ?? null;
        return maybe == null ? null : String(maybe);
      }
      return String(v);
    };

    organiserData.value.groups.forEach((g: any) => {
      const pid = normalizeId(g.parentId ?? g.parent_id ?? null);
      if (pid === String(groupId)) {
        const newParent = groupToDelete
          ? normalizeId(groupToDelete.parentId ?? (groupToDelete as any).parent_id ?? null)
          : null;
        // preserve original key style when updating (store as string or remove)
        if (g.parentId !== undefined) {
          if (newParent) g.parentId = newParent;
          else delete g.parentId;
        } else if (g.parent_id !== undefined) {
          if (newParent) g.parent_id = newParent;
          else delete g.parent_id;
        } else {
          // default to camelCase
          if (newParent) g.parentId = newParent;
        }
      }
    });

    await saveData();
  };

  const getGroupsByParent = (parentId?: string): TaskGroup[] => {
    const norm = parentId == null ? null : String(parentId);
    const normalize = (v: any): string | null => {
      if (v == null) return null;
      if (typeof v === 'object') return (v.value ?? v.id) ? String(v.value ?? v.id) : null;
      return String(v);
    };
    return organiserData.value.groups.filter((g: any) => {
      const pid = normalize(g.parentId ?? g.parent_id ?? null);
      if (pid == null && norm == null) return true;
      if (pid != null && norm != null) return String(pid) === norm;
      return false;
    });
  };

  // Derived tree representation for UI and privileges. This does NOT mutate stored group objects.
  const groupTree = computed(() => {
    const raw = organiserData.value.groups || [];
    const map = new Map<string, any>();
    // Create node wrappers that reference the original group objects (do not mutate groups)
    const normalize = (v: any): string | null => {
      if (v == null) return null;
      if (typeof v === 'object') return (v.value ?? v.id) ? String(v.value ?? v.id) : null;
      return String(v);
    };

    raw.forEach((g: any) => {
      map.set(String(g.id), {
        id: g.id,
        label: g.name,
        icon: g.icon,
        color: g.color,
        // store reference to original group
        group: g,
        parentId: normalize(g.parentId ?? g.parent_id ?? null),
        shareSubgroups: g.shareSubgroups ?? false,
        children: [] as any[],
      });
    });

    const roots: any[] = [];
    map.forEach((node) => {
      if (node.parentId == null) {
        roots.push(node);
      } else {
        const parent = map.get(String(node.parentId));
        if (parent) parent.children.push(node);
        else roots.push(node); // orphaned parent -> treat as root
      }
    });
    return roots;
  });

  const getGroupHierarchy = (): any[] => {
    return groupTree.value;
  };

  return {
    // State
    organiserData,
    isLoading,
    currentDate,
    currentDayData,

    // Methods
    loadData,
    saveData,
    getDayData,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskComplete,
    updateDayNotes,
    getTasksInRange,
    getTasksByCategory,
    getTasksByPriority,
    getIncompleteTasks,
    exportData,
    importData,

    // Groups
    groups: computed(() => organiserData.value.groups),
    // Shared active group state for UI components
    activeGroup: activeGroup,
    addGroup,
    updateGroup,
    deleteGroup,
    getGroupsByParent,
    getGroupHierarchy,

    // Navigation
    setCurrentDate,
    goToToday,
    nextDay,
    prevDay,

    // Preview helper
    // Preview helper: supports either an id string or a payload object { id, date, ... }
    previewTaskId: computed(() => previewTaskId.value),
    previewTaskPayload: computed(() => previewTaskPayload.value),
    setPreviewTask: (payload: string | number | Record<string, unknown> | null) => {
      if (payload == null) {
        previewTaskId.value = null;
        previewTaskPayload.value = null;
        return;
      }
      if (typeof payload === 'string' || typeof payload === 'number') {
        previewTaskId.value = String(payload);
        previewTaskPayload.value = null;
        return;
      }
      // object payload -> store both id and payload
      const p = payload;
      const pid = p['id'];
      previewTaskId.value = typeof pid === 'string' || typeof pid === 'number' ? String(pid) : null;
      previewTaskPayload.value = p;
    },

    // Utils
    formatDate,
    // Undo a cycleDone entry for a specific task/date. Returns true if an entry was removed.
    undoCycleDone,
  };
}

// (group helpers moved into useDayOrganiser scope)
