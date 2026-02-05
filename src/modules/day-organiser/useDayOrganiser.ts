import { ref, computed, watch } from 'vue';
import type { Task } from '../task/types';
import type { DayData, OrganiserData, TaskGroup } from './types';
import { storage } from './storage';
import * as api from './api';
import {
  addGroup as addGroupService,
  updateGroup as updateGroupService,
  deleteGroup as deleteGroupService,
} from '../group/groupService';
import type { CreateGroupInput } from '../group/groupService';
import logger from 'src/utils/logger';
import { getGroupsByParent as getGroupsByParentUtil, buildGroupTree } from '../group/groupUtils';
import {
  getTasksInRange as getTasksInRangeService,
  getTasksByCategory as getTasksByCategoryService,
  getTasksByPriority as getTasksByPriorityService,
  getIncompleteTasks as getIncompleteTasksService,
} from '../task/taskService';

// Format date to YYYY-MM-DD
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0] ?? '';
};

// Create a sanitized snapshot suitable for history entries.
// This avoids storing reactive proxies or circular structures which break JSON.stringify.
function sanitizeForHistory(value: any, depth = 2): any {
  if (value === null || value === undefined) return value;
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return value;
  if (t === 'function') return '[Function]';
  if (value instanceof Date) return value.toISOString();

  // Depth-limited serialization for objects/arrays to preserve useful fields
  // while avoiding deep traversal / circular refs.
  try {
    if (Array.isArray(value)) {
      if (depth <= 0) return '[Array]';
      return value.map((v) =>
        v === null || v === undefined
          ? v
          : typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
            ? v
            : v instanceof Date
              ? v.toISOString()
              : sanitizeForHistory(v, depth - 1),
      );
    }

    if (depth <= 0) return '[Object]';

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
          out[k] = sanitizeForHistory(v, depth - 1);
        } else if (typeof v === 'function') {
          out[k] = '[Function]';
        } else {
          out[k] = sanitizeForHistory(v, depth - 1);
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
        // Try to restore active group from persisted settings first
        try {
          const settings = await (await import('./storage')).loadSettings();
          const requestedId = settings?.activeGroupId ?? null;
          if (requestedId) {
            const found = grpList.find((g: any) => String(g.id) === String(requestedId));
            if (found) {
              activeGroup.value = { label: found.name || String(found.id), value: found.id };
            }
          }
        } catch (e) {
          // fallback to default first group
        }

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

  // Persist activeGroup changes to settings (debounced-ish behavior not necessary here)
  try {
    watch(
      () => activeGroup.value,
      async (val) => {
        try {
          const settingsMod = await import('./storage');
          const existing = (await settingsMod.loadSettings()) || {};
          const toSave = { ...existing, activeGroupId: val?.value ?? null };
          await settingsMod.saveSettings(toSave);
        } catch (err) {
          logger.error('Failed to persist activeGroup setting', err);
        }
      },
      { immediate: false },
    );
  } catch (e) {
    void e;
  }

  // Save data to storage
  const saveData = async () => {
    try {
      // Persist organiserData: assemble groups with current tasks so disk files
      // reflect the canonical tasks stored in `days`.
      try {
        const groupsOrig = Array.isArray(organiserData.value.groups)
          ? organiserData.value.groups
          : [];
        // shallow copy groups and ensure tasks array exists
        const groupsForSave = groupsOrig.map((g: any) => ({ ...(g || {}), tasks: [] }));
        const groupIndex = new Map<string, any>();
        for (const g of groupsForSave) {
          groupIndex.set(String(g.id), g);
        }
        // Collect tasks from days and push into matching group tasks arrays
        for (const dKey of Object.keys(organiserData.value.days)) {
          const day = organiserData.value.days[dKey];
          if (!day || !Array.isArray(day.tasks)) continue;
          for (const t of day.tasks) {
            const gid = t && (t.groupId ?? null);
            if (gid != null && groupIndex.has(String(gid))) {
              groupIndex.get(String(gid)).tasks.push(t);
            }
          }
        }
        const dataToSave: OrganiserData = {
          ...organiserData.value,
          groups: groupsForSave,
        };
        await storage.saveData(dataToSave);
      } catch (err) {
        // Fallback: persist organiserData as-is
        await storage.saveData(organiserData.value as OrganiserData);
      }
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

  // `dayOrganiserApi` is a small exported singleton (see ./api) that will be
  // assigned below with real implementations; keeping it in a separate file
  // keeps this module focused on organiser logic.

  // Provide runtime context (organiserData + saveData) to the API module.
  api.setContext({ organiserData, saveData });

  // Delete / toggle / undo now provided by `api` via setContext.

  // Update day notes
  const updateDayNotes = async (date: string, notes: string): Promise<void> => {
    const dayData = getDayData(date);
    dayData.notes = notes;
    await saveData();
  };

  // Get tasks for a date range
  const getTasksInRange = (startDate: string, endDate: string): Task[] =>
    getTasksInRangeService(organiserData.value, startDate, endDate);

  // Get tasks by category
  const getTasksByCategory = (category: Task['category']): Task[] =>
    getTasksByCategoryService(organiserData.value, category);

  // Get tasks by priority
  const getTasksByPriority = (priority: Task['priority']): Task[] =>
    getTasksByPriorityService(organiserData.value, priority);

  // Get incomplete tasks
  const getIncompleteTasks = (): Task[] => getIncompleteTasksService(organiserData.value);

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
  // (undoCycleDone provided by API)
  // Group management helpers (delegated to groupService)
  const addGroup = async (groupInput: CreateGroupInput): Promise<TaskGroup> => {
    const group = addGroupService(organiserData.value, groupInput);
    await saveData();
    return group;
  };

  const updateGroup = async (
    groupId: string,
    updates: Partial<Omit<TaskGroup, 'id' | 'createdAt'>>,
  ): Promise<void> => {
    updateGroupService(organiserData.value, groupId, updates);
    await saveData();
  };

  const deleteGroup = async (groupId: string): Promise<void> => {
    const { groupHasTasks } = deleteGroupService(organiserData.value, groupId);
    await saveData();

    // If the deleted group had no tasks, remove its file from disk
    try {
      if (!groupHasTasks) {
        const storageMod = await import('./storage');
        if (storageMod && typeof storageMod.deleteGroupFile === 'function') {
          await storageMod.deleteGroupFile(groupId);
        }
      }
    } catch (err) {
      logger.error('Failed to delete group file for', groupId, err);
    }
  };

  const getGroupsByParent = (parentId?: string): TaskGroup[] => {
    return getGroupsByParentUtil(organiserData.value.groups, parentId);
  };

  // Derived tree representation for UI and privileges. This does NOT mutate stored group objects.
  const groupTree = computed(() => buildGroupTree(organiserData.value.groups));

  // Summary of tasks from child groups that hide tasks from parent
  const hiddenGroupSummary = computed(() => {
    try {
      if (!activeGroup.value || activeGroup.value.value === null)
        return { total: 0, low: 0, medium: 0, high: 0, critical: 0, groups: [] };
      const activeId = String(activeGroup.value.value);
      const getGroupById = (id: any) =>
        (organiserData.value.groups || []).find((g: any) => String(g.id) === String(id));

      // Find groups that have hideTasksFromParent === true and are direct children of activeGroup
      const hiddenGroupIds = new Set<string>();
      (organiserData.value.groups || []).forEach((g: any) => {
        try {
          if (!g || !g.id) return;
          if (!g.hideTasksFromParent) return;
          const parent = g.parentId ?? g.parent_id ?? null;
          if (parent && String(parent) === activeId) hiddenGroupIds.add(String(g.id));
        } catch (e) {
          void e;
        }
      });

      if (hiddenGroupIds.size === 0)
        return { total: 0, low: 0, medium: 0, high: 0, critical: 0, groups: [] };

      // Initialize per-group counters
      const groupsMap = new Map<string, any>();
      for (const id of Array.from(hiddenGroupIds)) {
        const g = getGroupById(id) || { id, name: '(unknown)' };
        groupsMap.set(String(id), {
          id: String(id),
          name: g.name || String(id),
          total: 0,
          low: 0,
          medium: 0,
          high: 0,
          critical: 0,
        });
      }

      const all = getTasksInRangeService(organiserData.value, '1970-01-01', '9999-12-31') || [];
      for (const t of all) {
        try {
          if (!t || !t.groupId) continue;
          const gid = String(t.groupId);
          if (!hiddenGroupIds.has(gid)) continue;
          if (Number(t.status_id) === 0) continue; // skip done
          const p = t.priority || 'medium';
          const entry = groupsMap.get(gid);
          if (!entry) continue;
          entry[p] = (entry[p] || 0) + 1;
          entry.total++;
        } catch (e) {
          void e;
        }
      }

      // Build final list and totals
      const groupsArr = Array.from(groupsMap.values()).sort((a: any, b: any) =>
        String(a.name).localeCompare(String(b.name)),
      );
      const totals: { total: number; low: number; medium: number; high: number; critical: number } =
        {
          total: 0,
          low: 0,
          medium: 0,
          high: 0,
          critical: 0,
        };
      for (const g of groupsArr) {
        totals.total += g.total || 0;
        totals.low += g.low || 0;
        totals.medium += g.medium || 0;
        totals.high += g.high || 0;
        totals.critical += g.critical || 0;
      }

      return { ...totals, groups: groupsArr };
    } catch (e) {
      return { total: 0, low: 0, medium: 0, high: 0, critical: 0, groups: [] };
    }
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
    // Delegate add/update to the centralized API
    addTask: api.addTask,
    updateTask: api.updateTask,
    deleteTask: api.deleteTask,
    toggleTaskComplete: api.toggleTaskComplete,
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
    hiddenGroupSummary,

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
    undoCycleDone: api.undoCycleDone,
  };
}

// (group helpers moved into useDayOrganiser scope)
