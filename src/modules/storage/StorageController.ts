import { ref, watch } from 'vue';
import logger from '../../utils/logger';
import { storage as backendStorage, loadSettings, saveSettings } from './StorageBackend';
import { presentation } from 'src/modules/presentation/presentationManager';
import { sampleData } from 'src/modules/presentation/sampleData';
import * as taskService from 'src/modules/task/managers/taskManager';

export class ApiStorage {
  isLoading = ref(false);
  private suppressPersist = true;
  private groupApi: any;
  private timeApi: any;

  constructor(groupApi?: any, timeApi?: any) {
    this.groupApi = groupApi;
    this.timeApi = timeApi;
    try {
      if (
        this.groupApi &&
        this.groupApi.active &&
        typeof this.groupApi.active.activeGroup !== 'undefined'
      ) {
        watch(
          () => this.groupApi.active.activeGroup.value,
          async (val) => {
            try {
              if (this.suppressPersist) return;
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
  }

  async loadData() {
    this.suppressPersist = true;
    this.isLoading.value = true;
    logger.debug('apiStorage.loadData called');
    try {
      let data: any;
      try {
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

      try {
        const finalDays =
          data.days && Object.keys(data.days).length > 0
            ? data.days
            : Object.keys(daysFromGroups).length
              ? daysFromGroups
              : {};

        try {
          if (
            this.groupApi &&
            this.groupApi.list &&
            typeof this.groupApi.list.setGroups === 'function'
          ) {
            this.groupApi.list.setGroups(rawGroups || []);
            try {
              logger.debug('apiStorage.loadData: groups set, count=', (rawGroups || []).length);
            } catch (e) {
              void e;
            }

            try {
              const defaultActive = (data && data.defaultActiveGroup) || null;
              if (defaultActive) {
                const groupsList =
                  this.groupApi && this.groupApi.list && this.groupApi.list.all
                    ? this.groupApi.list.all.value
                    : [];
                const found = (groupsList || []).find(
                  (g: any) => String(g.id) === String(defaultActive),
                );
                if (found) {
                  if (this.groupApi.active && this.groupApi.active.activeGroup)
                    this.groupApi.active.activeGroup.value = {
                      label: found.name || String(found.id),
                      value: found.id,
                    };
                  else if (this.groupApi.activeGroup)
                    this.groupApi.activeGroup.value = {
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

        try {
          if (this.timeApi) {
            if (this.timeApi.days) this.timeApi.days.value = finalDays;
            if (this.timeApi.lastModified)
              this.timeApi.lastModified.value = data.lastModified || new Date().toISOString();
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

      try {
        if (this.groupApi && typeof loadSettings === 'function') {
          const settings = await loadSettings();
          const requestedId = settings?.activeGroupId ?? null;
          if (requestedId) {
            const groupsList =
              (this.groupApi && this.groupApi.list && this.groupApi.list.all
                ? this.groupApi.list.all.value
                : []) || [];
            const found = (groupsList || []).find((g: any) => String(g.id) === String(requestedId));
            if (found) {
              try {
                if (this.groupApi.active && this.groupApi.active.activeGroup)
                  this.groupApi.active.activeGroup.value = {
                    label: found.name || String(found.id),
                    value: found.id,
                  };
                else if (this.groupApi.activeGroup)
                  this.groupApi.activeGroup.value = {
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
        void e;
      }

      return data;
    } catch (err) {
      logger.error('apiStorage.loadData failed', err);
      throw err;
    } finally {
      this.suppressPersist = false;
      this.isLoading.value = false;
    }
  }

  async saveData(data?: any) {
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
      let payload = data;
      if (!payload) {
        const days = this.timeApi && this.timeApi.days ? this.timeApi.days.value : {};
        const lastModified =
          this.timeApi && this.timeApi.lastModified
            ? this.timeApi.lastModified.value
            : new Date().toISOString();

        const existingGroups =
          this.groupApi && this.groupApi.list && this.groupApi.list.all
            ? this.groupApi.list.all.value
            : [];
        const groupsMap: Record<string, any> = {};
        for (const g of existingGroups || []) {
          try {
            const meta = { ...g };
            if (meta && Object.prototype.hasOwnProperty.call(meta, 'tasks')) delete meta.tasks;
            groupsMap[String(g.id)] = { ...meta, tasks: [] };
          } catch (e) {
            void e;
          }
        }
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
                try {
                  const exists = groupsMap[gid].tasks.find(
                    (x: any) => String(x.id) === String(t.id),
                  );
                  if (!exists) groupsMap[gid].tasks.push(t);
                } catch (e) {
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
  }

  exportToFile(data: any) {
    try {
      if (typeof backendStorage.exportToFile === 'function') backendStorage.exportToFile(data);
    } catch (err) {
      logger.error('apiStorage.exportToFile failed', err);
      throw err;
    }
  }

  async importFromFile(file: File) {
    try {
      if (typeof backendStorage.importFromFile === 'function')
        return await backendStorage.importFromFile(file);
      throw new Error('importFromFile not implemented on backend');
    } catch (err) {
      logger.error('apiStorage.importFromFile failed', err);
      throw err;
    }
  }

  initApp() {
    return {
      loadData: this.loadData.bind(this),
      saveData: this.saveData.bind(this),
    } as const;
  }

  // expose backend settings helpers for callers that expect them
  loadSettings = loadSettings;
  saveSettings = saveSettings;
}

export function construct(groupApi?: any, timeApi?: any) {
  return new ApiStorage(groupApi, timeApi);
}

export type ApiStorageType = ReturnType<typeof construct>;
