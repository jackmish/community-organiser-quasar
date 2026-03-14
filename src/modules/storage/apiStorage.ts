import { ref, watch } from 'vue';
import logger from '../../utils/logger';
import { storage as backendStorage, loadSettings, saveSettings } from '.';
import { presentation } from 'src/modules/presentation/presentationManager';
import { sampleData } from 'src/modules/presentation/sampleData';
import * as taskService from 'src/modules/task/managers/taskManager';

export function construct(groupApi?: any, timeApi?: any) {
  const isLoading = ref(false);
  // Prevent persisting activeGroup while initial load/restore is in progress
  let suppressPersist = true;

  // No implicit wiring: storage will populate `timeApi.days` during `loadData`.
  const loadData = async () => {
    // While loading data we don't want watcher writes to overwrite restored settings
    suppressPersist = true;
    isLoading.value = true;
    logger.debug('apiStorage.loadData called');
    try {
      // If presentation test mode enabled, or localStorage flag present, load sample data instead of backend
      let data: any;
      try {
        // Use sample data when presentation mode is explicitly 'test' or 'presentation'.
        // Presentation is a safe-read-only session similar to test mode.
        const modeVal = presentation && presentation.mode ? presentation.mode.value : 'default';
        const sampleModeActive = modeVal === 'test' || modeVal === 'presentation';
        if (sampleModeActive) {
          logger.debug(
            'apiStorage.loadData: loading sampleData because presentation.mode ===',
            modeVal,
          );
          data = sampleData as any;
        }
      } catch (e) {
        void e;
      }
      if (!data) data = await backendStorage.loadData();
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

      // Populate the refactored API refs: time.days and group list
      try {
        // Prefer data.days (authoritative — contains ALL tasks including those without a groupId,
        // e.g. Todo tasks). Only fall back to the group-reconstructed map for legacy files that
        // were saved without a top-level `days` key.
        const finalDays =
          data.days && Object.keys(data.days).length > 0
            ? data.days
            : Object.keys(daysFromGroups).length
              ? daysFromGroups
              : {};

        // populate groupApi internal ref if available (use setter)
        try {
          if (groupApi && groupApi.list && typeof groupApi.list.setGroups === 'function') {
            groupApi.list.setGroups(rawGroups || []);
            try {
              logger.debug('apiStorage.loadData: groups set, count=', (rawGroups || []).length);
            } catch (e) {
              void e;
            }

            // If the loaded payload provides a `defaultActiveGroup`, apply it
            // (used by presentation/sampleData to indicate which group should be active).
            try {
              const defaultActive = (data && data.defaultActiveGroup) || null;
              if (defaultActive) {
                const groupsList =
                  groupApi && groupApi.list && groupApi.list.all ? groupApi.list.all.value : [];
                const found = (groupsList || []).find(
                  (g: any) => String(g.id) === String(defaultActive),
                );
                if (found) {
                  if (groupApi.active && groupApi.active.activeGroup)
                    groupApi.active.activeGroup.value = {
                      label: found.name || String(found.id),
                      value: found.id,
                    };
                  else if (groupApi.activeGroup)
                    groupApi.activeGroup.value = {
                      label: found.name || String(found.id),
                      value: found.id,
                    };
                }
              }
            } catch (e) {
              void e;
            }
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
            // Populate taskService flat list immediately so callers can use it
            try {
              const loaded = taskService.buildFlatTasksList(finalDays || {});
              taskService.flatTasks.value.splice(0, taskService.flatTasks.value.length, ...loaded);
              try {
                logger.debug(
                  'apiStorage.loadData: time.days populated, days=',
                  Object.keys(finalDays || {}).length,
                );
              } catch (e) {
                void e;
              }
            } catch (e) {
              void e;
            }
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
              (groupApi && groupApi.list && groupApi.list.all ? groupApi.list.all.value : []) || [];
            // restored activeGroup silently (no console log)
            const found = (groupsList || []).find((g: any) => String(g.id) === String(requestedId));
            if (found) {
              try {
                if (groupApi.active && groupApi.active.activeGroup)
                  groupApi.active.activeGroup.value = {
                    label: found.name || String(found.id),
                    value: found.id,
                  };
                else if (groupApi.activeGroup)
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
      // loading finished; allow watcher writes from now on
      suppressPersist = false;
      isLoading.value = false;
    }
  };

  const saveData = async (data?: any) => {
    // Block saving when test mode enabled
    try {
      const modeVal = presentation && presentation.mode ? presentation.mode.value : 'default';
      if (modeVal === 'test' || modeVal === 'presentation') {
        logger.debug('apiStorage.saveData blocked in presentation/test mode (', modeVal, ')');
        return;
      }
    } catch (e) {
      // ignore
    }
    try {
      // If caller didn't provide data, build it from refactored APIs
      let payload = data;
      if (!payload) {
        const days = timeApi && timeApi.days ? timeApi.days.value : {};
        const lastModified =
          timeApi && timeApi.lastModified ? timeApi.lastModified.value : new Date().toISOString();

        // Build groups payload from days so group files include newly created tasks.
        const existingGroups =
          groupApi && groupApi.list && groupApi.list.all ? groupApi.list.all.value : [];
        const groupsMap: Record<string, any> = {};
        // Seed groupsMap with existing group metadata (do NOT copy tasks here)
        for (const g of existingGroups || []) {
          try {
            const meta = { ...g };
            // Ensure we don't carry over any pre-existing tasks to avoid duplicates
            if (meta && Object.prototype.hasOwnProperty.call(meta, 'tasks')) delete meta.tasks;
            groupsMap[String(g.id)] = { ...meta, tasks: [] };
          } catch (e) {
            void e;
          }
        }
        // Iterate days and attach tasks to their group entries
        try {
          for (const dKey of Object.keys(days || {})) {
            const day = days[dKey];
            if (!day || !Array.isArray(day.tasks)) continue;
            for (const t of day.tasks) {
              try {
                const gid = t && t.groupId ? String(t.groupId) : null;
                if (!gid) continue;
                if (!groupsMap[gid]) {
                  groupsMap[gid] = { id: gid, name: String(gid), tasks: [] };
                }
                // Avoid duplicates: only add if not already present (by id)
                try {
                  const exists = groupsMap[gid].tasks.find(
                    (x: any) => String(x.id) === String(t.id),
                  );
                  if (!exists) groupsMap[gid].tasks.push(t);
                } catch (e) {
                  // fallback: push without check
                  try {
                    groupsMap[gid].tasks.push(t);
                  } catch (err) {
                    void err;
                  }
                }
              } catch (e) {
                void e;
              }
            }
          }
        } catch (e) {
          void e;
        }

        const groups = Object.keys(groupsMap).map((k) => groupsMap[k]);
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

  // Persist active group selection when provided by groupApi
  try {
    if (groupApi && groupApi.active && typeof groupApi.active.activeGroup !== 'undefined') {
      watch(
        () => groupApi.active.activeGroup.value,
        async (val) => {
          try {
            if (suppressPersist) {
              // suppress initial persist silently
              return;
            }
            const existing = (await loadSettings()) || {};
            const payload = { ...existing, activeGroupId: val?.value ?? null };
            await saveSettings(payload);
          } catch (e) {
            logger.error('[apiStorage] failed to persist activeGroup', e);
          }
        },
        { immediate: true },
      );
    }
  } catch (e) {
    void e;
  }

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

export type ApiStorage = ReturnType<typeof construct>;
