import { ref, computed } from 'vue';
import {
  isElectronApp,
  isSpaceAccessAvailable,
  loadActiveSpaceAccessStatus,
  verifyActiveSpacePassword,
} from 'src/modules/space/spaceAccessService';
import type { SpaceAccessStatus } from 'src/modules/space/spaceAccessModel';
import logger from 'src/utils/logger';

const checked = ref(false);
const checking = ref(false);
const status = ref<SpaceAccessStatus | null>(null);
const unlocked = ref(false);
const verifyError = ref('');

const authRequired = computed(
  () => !!status.value?.enabled && !!status.value?.hasPassword,
);

/** Shared reactive gate — do not recreate per useSpaceAuth() call. */
export const spaceAuthBlocked = computed(
  () => checked.value && authRequired.value && !unlocked.value,
);

async function waitForSpaceAccessApi(maxMs = 3000): Promise<boolean> {
  if (isSpaceAccessAvailable()) return true;
  if (!isElectronApp()) return false;
  const step = 50;
  for (let elapsed = 0; elapsed < maxMs; elapsed += step) {
    await new Promise((r) => setTimeout(r, step));
    if (isSpaceAccessAvailable()) return true;
  }
  return isSpaceAccessAvailable();
}

export function useSpaceAuth() {
  const blocked = spaceAuthBlocked;

  async function refreshStatus(): Promise<void> {
    checking.value = true;
    verifyError.value = '';
    try {
      const apiReady = await waitForSpaceAccessApi();
      if (!apiReady) {
        if (isElectronApp()) {
          logger.error('[spaceAuth] electronSpaceAccess unavailable in desktop app');
        } else {
          logger.warn('[spaceAuth] space access API unavailable — lock skipped (non-desktop)');
        }
        status.value = { enabled: false, hasPassword: false, method: null, spaceName: '' };
        unlocked.value = true;
        checked.value = true;
        return;
      }

      const loaded = await loadActiveSpaceAccessStatus();
      if (!loaded) {
        throw new Error('Empty space access status from main process');
      }
      status.value = loaded;

      if (!loaded.enabled || !loaded.hasPassword) {
        unlocked.value = true;
        logger.info('[spaceAuth] no password on active space', loaded.spaceName);
      } else {
        unlocked.value = false;
        logger.info('[spaceAuth] active space requires password', loaded.spaceName);
      }
      checked.value = true;
    } catch (e) {
      logger.error('[spaceAuth] failed to load access status', e);
      status.value = { enabled: false, hasPassword: false, method: null, spaceName: '' };
      unlocked.value = true;
      checked.value = true;
    } finally {
      checking.value = false;
    }
  }

  async function submitPassword(password: string): Promise<boolean> {
    verifyError.value = '';
    try {
      const ok = await verifyActiveSpacePassword(password);
      if (ok) {
        unlocked.value = true;
        return true;
      }
      verifyError.value = 'Incorrect password';
      return false;
    } catch (e) {
      verifyError.value = e instanceof Error ? e.message : String(e);
      return false;
    }
  }

  function lockAgain(): void {
    if (authRequired.value) {
      unlocked.value = false;
    }
  }

  function notifyUnlocked(): void {
    unlocked.value = true;
  }

  return {
    checked,
    checking,
    status,
    unlocked,
    verifyError,
    authRequired,
    blocked,
    refreshStatus,
    submitPassword,
    lockAgain,
    notifyUnlocked,
  };
}
