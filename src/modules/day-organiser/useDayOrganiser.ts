import { ref, computed, watch } from 'vue';
import type { DayData, OrganiserData, TaskGroup } from './types';
import { storage } from './storage';
import logger from 'src/utils/logger';
import * as api from './api';

import { createHiddenGroupSummary } from '../task/hiddenGroupSummary';

// Format date to YYYY-MM-DD
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0] ?? '';
};

// Reactive state (owned by api module)
const isLoading = ref(false);

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

      api.organiserData.value = {
        days: Object.keys(daysMap).length ? daysMap : (data as any).days || {},
        groups: rawGroups,
        lastModified: (data as any).lastModified || new Date().toISOString(),
      };

      // If no activeGroup was set previously, default to the first group (if any)
      try {
        const grpList = api.organiserData.value.groups || [];
        // Try to restore active group from persisted settings first
        try {
          const settings = await (await import('./storage')).loadSettings();
          const requestedId = settings?.activeGroupId ?? null;
          if (requestedId) {
            const found = grpList.find((g: any) => String(g.id) === String(requestedId));
            if (found) {
              api.activeGroup.value = { label: found.name || String(found.id), value: found.id };
            }
          }
        } catch (e) {
          // fallback to default first group
        }

        if (
          (!api.activeGroup.value || api.activeGroup.value === null) &&
          Array.isArray(grpList) &&
          grpList.length > 0
        ) {
          const fg = grpList[0];
          if (fg) {
            const fid = (fg as any).id;
            const fname = (fg as any).name || String(fid);
            api.activeGroup.value = { label: fname, value: fid };
          }
        }
      } catch (e) {
        // ignore
      }
    } catch (error) {
      logger.error('Failed to load data:', error);
    } finally {
      isLoading.value = false;
    }
  };

  // Persist activeGroup changes to settings (debounced-ish behavior not necessary here)
  try {
    watch(
      () => api.activeGroup.value,
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

  // Persistence is handled by the centralized API (`api.saveData`).

  // Get day data for a specific date
  const getDayData = (date: string): DayData => {
    if (!api.organiserData.value.days[date]) {
      api.organiserData.value.days[date] = {
        date,
        tasks: [],
        notes: '',
      };
    }
    return api.organiserData.value.days[date];
  };

  // Current day data
  const currentDayData = computed(() => getDayData(api.currentDate.value));

  // Export data
  const exportData = () => {
    storage.exportToFile(api.organiserData.value);
  };

  // Import data
  const importData = async (file: File) => {
    try {
      const data = await storage.importFromFile(file);
      // Preserve imported data shape exactly; do not normalize or remove fields.
      api.organiserData.value = data;
      await api.saveData();
    } catch (error) {
      logger.error('Failed to import data:', error);
      throw error;
    }
  };

  // Set current date
  const setCurrentDate = (date: string | number | null) => {
    if (date && typeof date === 'string') {
      api.currentDate.value = date;
    }
  };

  // Navigate to today
  const goToToday = () => {
    api.currentDate.value = formatDate(new Date());
  };

  // Navigate to next day
  const nextDay = () => {
    const date = new Date(api.currentDate.value);
    date.setDate(date.getDate() + 1);
    api.currentDate.value = formatDate(date);
  };

  // Navigate to previous day
  const prevDay = () => {
    const date = new Date(api.currentDate.value);
    date.setDate(date.getDate() - 1);
    api.currentDate.value = formatDate(date);
  };

  // Undo a cycleDone history entry for a specific task/date.
  // Returns true if an entry was removed and data saved.
  // (undoCycleDone provided by API)
  // Group management delegated to centralized API
  const addGroup = api.addGroup;
  const updateGroup = api.updateGroup;
  const deleteGroup = api.deleteGroup;
  const getGroupsByParent = api.getGroupsByParent;
  const groupTree = api.groupTree;

  // Summary of tasks from child groups that hide tasks from parent
  const hiddenGroupSummary = createHiddenGroupSummary(api.organiserData, api.activeGroup);

  return {
    // State
    organiserData: api.organiserData,
    isLoading,
    currentDate: api.currentDate,
    currentDayData,

    // Methods
    loadData,
    saveData: api.saveData,
    getDayData,
    // Delegate add/update to the centralized API
    addTask: api.addTask,
    updateTask: api.updateTask,
    deleteTask: api.deleteTask,
    toggleTaskComplete: api.toggleTaskComplete,
    updateDayNotes: api.updateDayNotes,
    getTasksInRange: api.getTasksInRange,
    getTasksByCategory: api.getTasksByCategory,
    getTasksByPriority: api.getTasksByPriority,
    getIncompleteTasks: api.getIncompleteTasks,
    exportData,
    importData,

    // Groups
    groups: computed(() => api.organiserData.value.groups),
    // Shared active group state for UI components
    activeGroup: api.activeGroup,
    addGroup,
    updateGroup,
    deleteGroup,
    getGroupsByParent,
    getGroupHierarchy: () => groupTree.value,
    hiddenGroupSummary,

    // Navigation
    setCurrentDate,
    goToToday,
    nextDay,
    prevDay,

    // Preview helper
    // Preview helper: supports either an id string or a payload object { id, date, ... }
    previewTaskId: computed(() => api.previewTaskId.value),
    previewTaskPayload: computed(() => api.previewTaskPayload.value),
    setPreviewTask: api.setPreviewTask,

    // Utils
    formatDate,
    // Undo a cycleDone entry for a specific task/date. Returns true if an entry was removed.
    undoCycleDone: api.undoCycleDone,
  };
}

// (group helpers moved into useDayOrganiser scope)
