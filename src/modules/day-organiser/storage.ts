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
      // Delegate loading and ref population to the storage API.
      await api.storage.loadData();
    } catch (error) {
      logger.error('Failed to load data:', error);
    }
  };

  // Persist activeGroup changes to settings
  try {
    watch(
      () => api.group.active.activeGroup.value,
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
    if (!api.time.days.value[date]) {
      api.time.days.value[date] = { date, tasks: [], notes: '' } as DayData;
    }
    return api.time.days.value[date];
  };

  const currentDayData = computed(() => getDayData(api.time.currentDate.value));

  const exportData = () => {
    const payload = {
      days: api.time.days.value,
      groups: api.group.list.all.value,
      lastModified: api.time.lastModified.value,
    };
    if (typeof api.storage.exportToFile === 'function') return api.storage.exportToFile(payload);
    return storage.exportToFile(payload);
  };

  const importData = async (file: File) => {
    try {
      const data = await api.storage.importFromFile(file);
      if (data) {
        // Persist imported payload then reload to populate refs
        await api.storage.saveData(data);
        await api.storage.loadData();
      }
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

  const organiserLike = computed(() => ({
    groups: api.group.list.all.value,
    days: api.time.days.value,
  }));

  const hiddenGroupSummary = createHiddenGroupSummary(
    organiserLike as any,
    api.group.active.activeGroup,
  );

  // Minimal public surface: prefer using `api.*` namespaced APIs directly
  const instance = {
    // State
    organiserData: organiserLike,
    isLoading: api.storage.isLoading,
    currentDate: api.time.currentDate,
    currentDayData,

    // Methods
    loadData,
    saveData: api.storage.saveData,
    getDayData,

    // Navigation
    setCurrentDate,
    goToToday,
    nextDay,
    prevDay,

    // Preview (mapped to new task active API)
    previewTaskId: computed(() => api.task.active.task.value?.id ?? null),
    previewTaskPayload: computed(() => api.task.active.task.value),

    // Misc
    exportData,
    importData,
    formatDate,
  };

  _dayOrganiserInstance = instance;

  return _dayOrganiserInstance;
}
