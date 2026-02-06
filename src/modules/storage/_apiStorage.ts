import { ref } from 'vue';
import logger from 'src/utils/logger';
import { storage as backendStorage, loadSettings, saveSettings } from '.';

export function createStorageApi(store: any) {
  const isLoading = ref(false);

  const loadData = async () => {
    isLoading.value = true;
    console.log('apiStorage.loadData called');
    try {
      const data = await backendStorage.loadData();
      // If backend returns groups with embedded `tasks`, reconstruct `days` map
      const rawGroups = Array.isArray(data?.groups) ? data.groups : [];
      const daysFromGroups: Record<string, any> = {};
      const groupsHaveTasks = rawGroups.some((g: any) => Array.isArray(g.tasks) && g.tasks.length > 0);
      if (groupsHaveTasks) {
        for (const grp of rawGroups) {
          const tasks = Array.isArray(grp.tasks) ? grp.tasks : [];
          for (const t of tasks) {
            try {
              const dateKey = t?.date || t?.eventDate || new Date().toISOString().split('T')[0];
              if (!daysFromGroups[dateKey]) daysFromGroups[dateKey] = { date: dateKey, tasks: [], notes: '' };
              if (!t.groupId) t.groupId = grp.id;
              daysFromGroups[dateKey].tasks.push(t);
            } catch (e) {
              void e;
            }
          }
        }
      }

      // Populate the provided store so callers relying on api.store see data
      try {
        store.organiserData.value = {
          days: Object.keys(daysFromGroups).length ? daysFromGroups : data.days || {},
          groups: rawGroups,
          lastModified: data.lastModified || new Date().toISOString(),
        };
      } catch (e) {
        // if store assignment fails, still return raw data
        logger.warn('Failed to assign organiserData to store in api.storage.loadData', e);
      }

      return data;
    } catch (err) {
      logger.error('apiStorage.loadData failed', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const saveData = async (data: any) => {
    try {
      await backendStorage.saveData(data);
    } catch (err) {
      logger.error('apiStorage.saveData failed', err);
      throw err;
    }
  };

  const exportToFile = (data: any) => {
    try {
      if (typeof backendStorage.exportToFile === 'function') backendStorage.exportToFile(data);
    } catch (err) {
      logger.error('apiStorage.exportToFile failed', err);
      throw err;
    }
  };

  const importFromFile = async (file: File) => {
    try {
      if (typeof backendStorage.importFromFile === 'function')
        return await backendStorage.importFromFile(file);
      throw new Error('importFromFile not implemented on backend');
    } catch (err) {
      logger.error('apiStorage.importFromFile failed', err);
      throw err;
    }
  };

  // convenience init hook: returns a tiny surface bound to store
  const initApp = () =>
    ({
      loadData: loadData,
      saveData: saveData,
    }) as const;

  return {
    isLoading,
    loadData,
    saveData,
    exportToFile,
    importFromFile,
    // expose settings helpers
    loadSettings,
    saveSettings,
    initApp,
  } as const;
}

export type ApiStorage = ReturnType<typeof createStorageApi>;
