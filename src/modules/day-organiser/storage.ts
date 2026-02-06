import { ref, computed, watch } from 'vue';
import type { DayData } from './types';
import { storage, loadSettings, saveSettings } from '../storage';
import logger from 'src/utils/logger';
import * as api from './_apiRoot';
import { createHiddenGroupSummary } from 'src/modules/task/hiddenGroupSummaryFixed';

export {
  storage,
  getGroupFilesDirectory,
  getGroupFilename,
  saveGroupsToFiles,
  loadSettings,
  saveSettings,
  deleteGroupFile,
} from '../storage';

function formatDate(d: Date | string) {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate(),
  ).padStart(2, '0')}`;
}
let _dayOrganiserInstance: any = null;

export function useDayOrganiser() {
  if (_dayOrganiserInstance) return _dayOrganiserInstance;

  const loadData = async () => {
    try {
      const data = await api.storage.loadData();
      // If storage returns groups with embedded `tasks`, reconstruct `days` map.
      const rawGroups = Array.isArray(data?.groups) ? data.groups : [];
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
        days: Object.keys(daysFromGroups).length ? daysFromGroups : data.days || {},
        groups: rawGroups,
        lastModified: data.lastModified || new Date().toISOString(),
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
            api.group.activeGroup.value = {
              label: found.name || String(found.id),
              value: found.id,
            };
        }
      } catch (e) {
        void e;
      }
    } catch (error) {
      logger.error('Failed to load data:', error);
    }
  };

  // Persist activeGroup changes to settings
  try {
    watch(
      () => api.group.activeGroup.value,
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

  const currentDayData = computed(() => getDayData(api.time.currentDate.value));

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
    if (date && typeof date === 'string') api.time.setCurrentDate(String(date));
  };

  const goToToday = () => api.time.goToToday();
  const nextDay = () => api.time.nextDay();
  const prevDay = () => api.time.prevDay();

  const hiddenGroupSummary = createHiddenGroupSummary(
    api.store.organiserData,
    api.group.activeGroup,
  );

  // Minimal public surface: prefer using `api.*` namespaced APIs directly
  const instance = {
    // State
    organiserData: api.store.organiserData,
    isLoading: api.storage.isLoading,
    currentDate: api.time.currentDate,
    currentDayData,

    // Methods
    loadData,
    saveData: api.store.saveData,
    getDayData,

    // Navigation
    setCurrentDate,
    goToToday,
    nextDay,
    prevDay,

    // Preview (retained minimal refs)
    previewTaskId: computed(() => api.task.previewTaskId.value),
    previewTaskPayload: computed(() => api.task.previewTaskPayload.value),

    // Misc
    exportData,
    importData,
    formatDate,
  };

  _dayOrganiserInstance = instance;

  return _dayOrganiserInstance;
}
