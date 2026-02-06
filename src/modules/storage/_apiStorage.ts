import { ref } from 'vue';
import logger from '../../utils/logger';
import { storage as backendStorage, loadSettings, saveSettings } from '.';

export function createStorageApi(store: any, groupApi?: any, timeApi?: any) {
  const isLoading = ref(false);

  const loadData = async () => {
    isLoading.value = true;
    console.log('apiStorage.loadData called');
    try {
      const data = await backendStorage.loadData();
      // If backend returns groups with embedded `tasks`, reconstruct `days` map
      const rawGroups: any[] = Array.isArray(data?.groups) ? (data.groups as any[]) : [];
      const daysFromGroups: Record<string, any> = {};
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
              if (!t.groupId) t.groupId = grp.id;
              daysFromGroups[dateKey].tasks.push(t);
            } catch (e) {
              void e;
            }
          }
        }
      }

      // Populate the refactored API refs: time.days and group._groupsRef
      try {
        const finalDays = Object.keys(daysFromGroups).length ? daysFromGroups : data.days || {};

        // populate groupApi internal ref if available
        try {
          if (groupApi && groupApi._groupsRef) {
            groupApi._groupsRef.value = rawGroups;
          }
        } catch (e) {
          void e;
        }

        // populate timeApi days/lastModified if provided
        try {
          if (timeApi) {
            if (timeApi.days) timeApi.days.value = finalDays;
            if (timeApi.lastModified)
              timeApi.lastModified.value = data.lastModified || new Date().toISOString();
          }
        } catch (e) {
          void e;
        }
      } catch (e) {
        logger.warn('Failed to populate refactored API refs in api.storage.loadData', e);
      }

      // Restore active group from settings if groupApi was provided
      try {
        if (groupApi && typeof loadSettings === 'function') {
          const settings = await loadSettings();
          const requestedId = settings?.activeGroupId ?? null;
          if (requestedId) {
            const groupsList =
              groupApi && groupApi._groupsRef && groupApi._groupsRef.value
                ? groupApi._groupsRef.value
                : store.organiserData.value.groups || [];
            const found = (groupsList || []).find((g: any) => String(g.id) === String(requestedId));
            if (found) {
              try {
                groupApi.activeGroup.value = {
                  label: found.name || String(found.id),
                  value: found.id,
                };
              } catch (e) {
                void e;
              }
            }
          }
        }
      } catch (e) {
        // ignore settings restore errors
        void e;
      }

      return data;
    } catch (err) {
      logger.error('apiStorage.loadData failed', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const saveData = async (data?: any) => {
    try {
      // If caller didn't provide data, build it from refactored APIs
      let payload = data;
      if (!payload) {
        const groups = groupApi && groupApi._groupsRef ? groupApi._groupsRef.value : [];
        const days =
          timeApi && timeApi.days ? timeApi.days.value : store.organiserData?.value?.days || {};
        const lastModified =
          timeApi && timeApi.lastModified ? timeApi.lastModified.value : new Date().toISOString();
        payload = { days, groups, lastModified };
      }
      await backendStorage.saveData(payload);
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
