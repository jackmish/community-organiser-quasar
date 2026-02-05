import { ref, computed, watch } from 'vue';
import type { DayData, OrganiserData } from './types';
import { storage, loadSettings, saveSettings } from './storage';
import logger from 'src/utils/logger';
import * as api from './_apiRoot';
import { createHiddenGroupSummary } from 'src/modules/task/hiddenGroupSummaryFixed';

function formatDate(d: Date | string) {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate(),
  ).padStart(2, '0')}`;
}

export function useDayOrganiser() {
  const isLoading = ref(false);

  const loadData = async () => {
    isLoading.value = true;
    try {
      const data = await storage.loadData();
      // If storage returns groups with embedded `tasks`, reconstruct `days` map.
      const rawGroups = Array.isArray((data as any)?.groups) ? (data as any).groups : [];
      const daysFromGroups: Record<string, any> = {};
      // If groups contain tasks, rebuild days map from those tasks
      const groupsHaveTasks = rawGroups.some(
        (g: any) => Array.isArray(g.tasks) && g.tasks.length > 0,
      );
      if (groupsHaveTasks) {
        for (const grp of rawGroups) {
          const tasks = Array.isArray(grp.tasks) ? grp.tasks : [];
          for (const t of tasks) {
            try {
              const dateKey = t?.date || t?.eventDate || new Date().toISOString().split('T')[0];
              if (!daysFromGroups[dateKey])
                daysFromGroups[dateKey] = { date: dateKey, tasks: [], notes: '' };
              // Ensure task has groupId set
              if (!t.groupId) t.groupId = grp.id;
              daysFromGroups[dateKey].tasks.push(t);
            } catch (e) {
              void e;
            }
          }
        }
      }

      api.store.organiserData.value = {
        days: Object.keys(daysFromGroups).length ? daysFromGroups : (data as any).days || {},
        groups: rawGroups,
        lastModified: (data as any).lastModified || new Date().toISOString(),
      };
      // Restore active group from settings if present
      try {
        const settings = await loadSettings();
        const requestedId = settings?.activeGroupId ?? null;
        if (requestedId) {
          const found = (api.store.organiserData.value.groups || []).find(
            (g: any) => String(g.id) === String(requestedId),
          );
          if (found)
            api.store.activeGroup.value = {
              label: found.name || String(found.id),
              value: found.id,
            };
        }
      } catch (e) {
        void e;
      }
    } catch (error) {
      logger.error('Failed to load data:', error);
    } finally {
      isLoading.value = false;
    }
  };

  // Persist activeGroup changes to settings
  try {
    watch(
      () => api.store.activeGroup.value,
      async (val) => {
        try {
          const existing = (await loadSettings()) || {};
          const toSave = { ...existing, activeGroupId: val?.value ?? null };
          await saveSettings(toSave);
        } catch (err) {
          logger.error('Failed to persist activeGroup setting', err);
        }
      },
      { immediate: false },
    );
  } catch (e) {
    void e;
  }

  const getDayData = (date: string): DayData => {
    if (!api.store.organiserData.value.days[date]) {
      api.store.organiserData.value.days[date] = { date, tasks: [], notes: '' } as DayData;
    }
    return api.store.organiserData.value.days[date];
  };

  const currentDayData = computed(() => getDayData(api.store.currentDate.value));

  const exportData = () => storage.exportToFile(api.store.organiserData.value);

  const importData = async (file: File) => {
    try {
      const data = await storage.importFromFile(file);
      api.store.organiserData.value = data;
      await api.store.saveData();
    } catch (error) {
      logger.error('Failed to import data:', error);
      throw error;
    }
  };

  const setCurrentDate = (date: string | number | null) => {
    if (date && typeof date === 'string') api.store.currentDate.value = date;
  };

  const goToToday = () => {
    api.store.currentDate.value = formatDate(new Date());
  };
  const nextDay = () => {
    const date = new Date(api.store.currentDate.value);
    date.setDate(date.getDate() + 1);
    api.store.currentDate.value = formatDate(date);
  };
  const prevDay = () => {
    const date = new Date(api.store.currentDate.value);
    date.setDate(date.getDate() - 1);
    api.store.currentDate.value = formatDate(date);
  };

  const hiddenGroupSummary = createHiddenGroupSummary(
    api.store.organiserData,
    api.store.activeGroup,
  );

  return {
    // State
    organiserData: api.store.organiserData,
    isLoading,
    currentDate: api.store.currentDate,
    currentDayData,

    // Methods
    loadData,
    saveData: api.store.saveData,
    getDayData,
    // legacy task methods (backwards compatible)
    addTask: api.task.add,
    updateTask: api.task.update,
    deleteTask: api.task.delete,
    toggleTaskComplete: api.task.status.toggleComplete,

    // prefer using `api.task.list.*` but keep compatibility by delegating here
    getTasksInRange: api.task.list.inRange,
    getTasksByCategory: api.task.list.byCategory,
    getTasksByPriority: api.task.list.byPriority,
    getIncompleteTasks: api.task.list.incomplete,
    setPreviewTask: api.task.setPreviewTask,

    // namespaced APIs
    task: api.task,
    group: api.group,

    // Groups
    groups: computed(() => api.store.organiserData.value.groups),
    activeGroup: api.store.activeGroup,
    addGroup: api.group.add,
    updateGroup: api.group.update,
    deleteGroup: api.group.delete,
    getGroupsByParent: api.group.getGroupsByParent,
    getGroupHierarchy: () => api.group.tree.value,
    hiddenGroupSummary,

    // Navigation
    setCurrentDate,
    goToToday,
    nextDay,
    prevDay,

    // Preview
    previewTaskId: computed(() => api.store.previewTaskId.value),
    previewTaskPayload: computed(() => api.store.previewTaskPayload.value),

    // Misc
    exportData,
    importData,
    formatDate,
    undoCycleDone: api.task.status.undoCycleDone,
  };
}
