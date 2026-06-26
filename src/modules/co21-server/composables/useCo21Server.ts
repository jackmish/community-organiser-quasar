import { onMounted, onUnmounted, ref } from 'vue';
import type { Co21ServerStatus } from '../co21ServerModel';
import { CO21_SERVER_CHANGED_EVENT } from '../co21ServerModel';
import {
  checkCo21ServerHealth,
  getCo21ServerStatus,
  isCo21ServerBridgeAvailable,
  startCo21ServerProcess,
  stopCo21ServerProcess,
} from '../co21ServerService';
import { co21ApiHealth } from '../co21ApiClient';
import { loadCo21ServerBaseUrl, loadCo21ServerEnabled } from '../co21ServerSettings';

export function useCo21Server() {
  const bridgeAvailable = ref(isCo21ServerBridgeAvailable());
  const enabled = ref(false);
  const running = ref(false);
  const healthy = ref(false);
  const status = ref<Co21ServerStatus | null>(null);
  const busy = ref(false);
  const lastError = ref('');

  async function refresh(): Promise<void> {
    bridgeAvailable.value = isCo21ServerBridgeAvailable();
    enabled.value = await loadCo21ServerEnabled();
    status.value = await getCo21ServerStatus();
    running.value = !!status.value?.running;
    const baseUrl = status.value?.baseUrl || (await loadCo21ServerBaseUrl());
    healthy.value = await co21ApiHealth(baseUrl);
    if (!healthy.value && !running.value) {
      healthy.value = await checkCo21ServerHealth(baseUrl);
      running.value = healthy.value;
    }
    lastError.value = status.value?.lastError || '';
  }

  async function start(): Promise<boolean> {
    busy.value = true;
    try {
      const result = await startCo21ServerProcess();
      if (!result.ok) {
        lastError.value = result.error || 'Failed to start CO21 backend server';
        await refresh();
        return false;
      }
      await refresh();
      return true;
    } finally {
      busy.value = false;
    }
  }

  async function stop(): Promise<void> {
    busy.value = true;
    try {
      await stopCo21ServerProcess();
      await refresh();
    } finally {
      busy.value = false;
    }
  }

  function onChanged(): void {
    void refresh();
  }

  onMounted(() => {
    void refresh();
    window.addEventListener(CO21_SERVER_CHANGED_EVENT, onChanged);
  });

  onUnmounted(() => {
    window.removeEventListener(CO21_SERVER_CHANGED_EVENT, onChanged);
  });

  return {
    bridgeAvailable,
    enabled,
    running,
    healthy,
    status,
    busy,
    lastError,
    refresh,
    start,
    stop,
  };
}

/** @deprecated Use useCo21Server */
export const useCo21AiServer = useCo21Server;
