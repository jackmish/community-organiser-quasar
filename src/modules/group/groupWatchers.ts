import { watch } from 'vue';
import logger from 'src/utils/logger';
import type { Ref } from 'vue';

/** Minimal storage interface needed by group watchers. */
interface SettingsStorage {
  isLoading: Ref<boolean>;
  loadSettings: () => Promise<Record<string, any> | null>;
  saveSettings: (data: Record<string, any>) => Promise<void>;
}

/** Minimal group-controller interface needed by group watchers. */
interface GroupControllerShape {
  active: {
    activeGroup: Ref<{ label: string; value: string | null } | null>;
  };
}

/**
 * Wire all persistent side-effects that belong to the group domain.
 * Call once from the app bootstrap (e.g. StorageController.loadData resolves).
 *
 * Currently registers:
 *  - activeGroup → settings.activeGroupId  (skipped while data is loading)
 */
export function initGroupWatchers(groupCtrl: GroupControllerShape, storage: SettingsStorage): void {
  try {
    watch(
      () => groupCtrl.active.activeGroup.value ?? null,
      async (newVal) => {
        try {
          if (storage.isLoading.value) return;
          const existing = (await storage.loadSettings()) ?? {};
          await storage.saveSettings({ ...existing, activeGroupId: newVal?.value ?? null });
        } catch (e) {
          logger.error('[groupWatchers] failed to persist activeGroup', e);
        }
      },
    );
  } catch (e) {
    void e;
  }
}
