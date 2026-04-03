import { ref } from 'vue';
import logger from '../../utils/logger';
import {
  storage as backendStorage,
  loadSettings,
  saveSettings,
} from './backend/electron/electronBackend';
import { isPresentationModeActive } from 'src/composables/usePresentationGuard';
import { sampleData } from 'src/modules/presentation/sampleData';
import * as taskService from 'src/modules/task/managers/taskRepository';

/** Minimal shape StorageController needs from the group Pinia store. */
type ActiveGroupOption = { label: string; value: string | null } | null;
export interface GroupDeps {
  active?: { activeGroup?: { value: ActiveGroupOption } };
  /** Legacy direct-ref fallback */
  activeGroup?: { value: ActiveGroupOption };
  list?: {
    setGroups?: (arr: any[]) => void;
    all?: { readonly value: any[] };
  };
}
/** Minimal shape StorageController needs from the time repository object. */
export interface TimeDeps {
  days?: { value: Record<string, any> };
  lastModified?: { value: string };
}

/**
 * Discriminated union for the port-based registration API.
 * Each domain controller calls CC.storage.connect() with its own slice
 * instead of passing deps through the constructor.
 */
export type StoragePort = { kind: 'group'; data: GroupDeps } | { kind: 'time'; data: TimeDeps };

export class StorageController {
  isLoading = ref(false);
  private group: GroupDeps | undefined;
  private time: TimeDeps | undefined;

  /**
   * Connect a domain controller's data slice.
   * Called by CC.boot() for each registered controller before any
   * onStorageReady hooks run. Replaces constructor injection.
   */
  connect(port: StoragePort): void {
    if (port.kind === 'group') this.group = port.data;
    else if (port.kind === 'time') this.time = port.data;
  }

  async loadData() {
    this.isLoading.value = true;
    logger.debug('StorageController.loadData called');
    try {
      let data: any;
      if (isPresentationModeActive()) {
        logger.debug('StorageController.loadData: loading sampleData (presentation/test mode)');
        data = sampleData as any;
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
          if (this.group && this.group.list && typeof this.group.list.setGroups === 'function') {
            this.group.list.setGroups(rawGroups || []);
            try {
              logger.debug(
                'StorageController.loadData: groups set, count=',
                (rawGroups || []).length,
              );
            } catch (e) {
              void e;
            }

            try {
              const defaultActive = (data && data.defaultActiveGroup) || null;
              if (defaultActive) {
                const groupsList =
                  this.group && this.group.list && this.group.list.all
                    ? this.group.list.all.value
                    : [];
                const found = (groupsList || []).find(
                  (g: any) => String(g.id) === String(defaultActive),
                );
                if (found) {
                  if (this.group.active && this.group.active.activeGroup)
                    this.group.active.activeGroup.value = {
                      label: found.name || String(found.id),
                      value: found.id,
                    };
                  else if (this.group.activeGroup)
                    this.group.activeGroup.value = {
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
          if (this.time) {
            if (this.time.days) this.time.days.value = finalDays;
            if (this.time.lastModified)
              this.time.lastModified.value = data.lastModified || new Date().toISOString();
            try {
              const loaded = taskService.buildFlatTasksList(finalDays || {});
              taskService.flatTasks.value.splice(0, taskService.flatTasks.value.length, ...loaded);
              try {
                logger.debug(
                  'StorageController.loadData: time.days populated, days=',
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
        if (this.group && typeof loadSettings === 'function') {
          const settings = await loadSettings();
          const requestedId = settings?.activeGroupId ?? null;
          if (requestedId) {
            const groupsList =
              (this.group && this.group.list && this.group.list.all
                ? this.group.list.all.value
                : []) || [];
            const found = (groupsList || []).find((g: any) => String(g.id) === String(requestedId));
            if (found) {
              try {
                if (this.group.active && this.group.active.activeGroup)
                  this.group.active.activeGroup.value = {
                    label: found.name || String(found.id),
                    value: found.id,
                  };
                else if (this.group.activeGroup)
                  this.group.activeGroup.value = {
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
      logger.error('StorageController.loadData failed', err);
      throw err;
    } finally {
      this.isLoading.value = false;
    }
  }

  async saveData(data?: any) {
    if (isPresentationModeActive()) {
      logger.debug('StorageController.saveData: blocked in presentation/test mode');
      return;
    }
    try {
      let payload = data;
      if (!payload) {
        const days = this.time && this.time.days ? this.time.days.value : {};
        const lastModified =
          this.time && this.time.lastModified
            ? this.time.lastModified.value
            : new Date().toISOString();

        const existingGroups =
          this.group && this.group.list && this.group.list.all ? this.group.list.all.value : [];
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
      logger.error('StorageController.saveData failed', err);
      throw err;
    }
  }

  exportToFile(data: any) {
    try {
      if (typeof backendStorage.exportToFile === 'function') backendStorage.exportToFile(data);
    } catch (err) {
      logger.error('StorageController.exportToFile failed', err);
      throw err;
    }
  }

  async importFromFile(file: File) {
    try {
      if (typeof backendStorage.importFromFile === 'function')
        return await backendStorage.importFromFile(file);
      throw new Error('importFromFile not implemented on backend');
    } catch (err) {
      logger.error('StorageController.importFromFile failed', err);
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

export function construct(group?: GroupDeps, time?: TimeDeps) {
  const ctrl = new StorageController();
  if (group) ctrl.connect({ kind: 'group', data: group });
  if (time) ctrl.connect({ kind: 'time', data: time });
  return ctrl;
}

export type StorageControllerInstance = ReturnType<typeof construct>;
