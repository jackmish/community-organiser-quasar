import { ref, computed, watch } from 'vue';
import type { DayData } from './types';
import { storage, loadSettings, saveSettings } from '../storage';
import logger from 'src/utils/logger';
import CC from 'src/CentralController';
const CCx: any = CC as any;
import { createHiddenGroupSummary } from 'src/modules/task/helpers/hiddenGroupSummary';

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
      await CCx.storage.loadData();
    } catch (error) {
      logger.error('Failed to load data:', error);
    }
  };

  // Persist activeGroup changes to settings
  try {
    watch(
      () => CCx.group.active.activeGroup.value,
      async (val) => {
        try {
          logger.info('[day-organiser] activeGroup changed, persisting', { value: val });
          const existing = (await loadSettings()) || {};
          const toSave = { ...existing, activeGroupId: val?.value ?? null };
          logger.info('[day-organiser] saveSettings payload', toSave);
          await saveSettings(toSave);
        } catch (err) {
          logger.error('Failed to persist activeGroup setting', err);
        }
      },
      { immediate: true },
    );
  } catch (e) {
    void e;
  }

  const getDayData = (date: string): DayData => {
    if (!CCx.task.time.days.value[date]) {
      CCx.task.time.days.value[date] = { date, tasks: [], notes: '' } as DayData;
    }
    return CCx.task.time.days.value[date];
  };

  const currentDayData = computed(() => getDayData(CCx.task.time.currentDate.value));

  const exportData = () => {
    const payload = {
      days: CCx.task.time.days.value,
      groups: CCx.group.list.all.value,
      lastModified: CCx.task.time.lastModified.value,
    };
    if (typeof CCx.storage.exportToFile === 'function') return CCx.storage.exportToFile(payload);
    return storage.exportToFile(payload);
  };

  const importData = async (file: File) => {
    try {
      const data = await CCx.storage.importFromFile(file);
      if (data) {
        // Persist imported payload then reload to populate refs
        await CCx.storage.saveData(data);
        await CCx.storage.loadData();
      }
    } catch (error) {
      logger.error('Failed to import data:', error);
      throw error;
    }
  };

  const setCurrentDate = (date: string | number | null) => {
    if (date && typeof date === 'string') CCx.task.time.setCurrentDate(String(date));
  };

  const goToToday = () => CCx.task.time.goToToday();
  const nextDay = () => CCx.task.time.nextDay();
  const prevDay = () => CCx.task.time.prevDay();

  const organiserLike = computed(() => ({
    groups: CCx.group.list.all.value,
    days: CCx.task.time.days.value,
  }));

  const hiddenGroupSummary = createHiddenGroupSummary(
    organiserLike as any,
    CCx.group.active.activeGroup,
  );

  // Minimal public surface: prefer using `api.*` namespaced APIs directly
  const instance = {
    // State
    organiserData: organiserLike,
    isLoading: CCx.storage.isLoading,
    currentDate: CCx.task.time.currentDate,
    currentDayData,

    // Methods
    loadData,
    saveData: CCx.storage.saveData,
    getDayData,

    // Navigation
    setCurrentDate,
    goToToday,
    nextDay,
    prevDay,

    // Preview (mapped to new task active API)
    previewTaskId: computed(() => CCx.task.active.task.value?.id ?? null),
    previewTaskPayload: computed(() => CCx.task.active.task.value),

    // Misc
    exportData,
    importData,
    formatDate,
  };

  _dayOrganiserInstance = instance;

  return _dayOrganiserInstance;
}
