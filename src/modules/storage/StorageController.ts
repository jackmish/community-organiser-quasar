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
import {
  attachTasksToGroupsForSave,
  ingestGroupsTaskData,
} from 'src/modules/media/mediaTaskStorage';

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
  private dataLoaded = false;
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
      const { shouldUseCapacitorStorage } = await import('./backend/storagePlatform');
      if (shouldUseCapacitorStorage()) {
        const { migrateLegacyWebStorageToCapacitorFiles } = await import(
          './backend/mobile/capacitorStorageMigration'
        );
        await migrateLegacyWebStorageToCapacitorFiles();
      }

      let data: any;
      if (isPresentationModeActive()) {
        logger.debug('StorageController.loadData: loading sampleData (presentation/test mode)');
        data = sampleData as any;
      }
      if (!data) data = await backendStorage.loadData();

      const rawGroups: any[] = Array.isArray(data?.groups)
        ? (data.groups as any[]).filter((g) => {
            if (!g || typeof g !== 'object') return false;
            const id = (g as { id?: unknown }).id;
            return typeof id === 'string' && id.trim().length > 0;
          })
        : [];
      const ingested = ingestGroupsTaskData(rawGroups);

      try {
        const finalDays =
          data.days && Object.keys(data.days).length > 0
            ? data.days
            : Object.keys(ingested.days).length
              ? ingested.days
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
              taskService.setMediaTasks(ingested.mediaTasks);
              taskService.migrateMediaTasksFromDays();
              const loaded = taskService.buildFlatTasksList(this.time.days?.value || finalDays || {});
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
      this.dataLoaded = true;
      this.isLoading.value = false;
    }
  }

  async saveData(data?: any) {
    if (isPresentationModeActive()) {
      logger.debug('StorageController.saveData: blocked in presentation/test mode');
      return;
    }
    if (!this.dataLoaded) {
      logger.debug('StorageController.saveData: skipped before initial load');
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

        const { shouldUseCapacitorStorage } = await import('./backend/storagePlatform');
        if (shouldUseCapacitorStorage() && (!existingGroups || existingGroups.length === 0)) {
          const { capacitorStorage } = await import('./backend/mobile/capacitorBackend');
          const onDisk = await capacitorStorage.loadAllGroups();
          if (onDisk.length > 0) {
            logger.warn(
              '[StorageController] saveData skipped: memory empty but disk still has groups',
            );
            return;
          }
        }

        taskService.migrateMediaTasksFromDays();
        const groups = attachTasksToGroupsForSave(
          existingGroups || [],
          days || {},
          taskService.getMediaFlatList(),
        );
        payload = { days, groups, lastModified };
      }
      await backendStorage.saveData(payload);
      const { scheduleLanSyncAfterOrganiserChange } = await import(
        './sync/lanOrganiserSyncTrigger'
      );
      scheduleLanSyncAfterOrganiserChange();
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
