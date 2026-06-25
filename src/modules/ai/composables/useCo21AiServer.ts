import { onMounted, onUnmounted, ref } from 'vue';
import type { AiServerStatus } from '../aiServerModel';
import { AI_SERVER_CHANGED_EVENT } from '../aiServerModel';
import {
  checkAiServerHealth,
  getAiServerStatus,
  isAiServerBridgeAvailable,
  startAiServerProcess,
  stopAiServerProcess,
} from '../aiServerService';
import { co21ApiHealth } from '../co21ApiClient';
import { loadAiServerBaseUrl, loadAiServerEnabled } from '../aiServerSettings';

export function useCo21AiServer() {
  const bridgeAvailable = ref(isAiServerBridgeAvailable());
  const enabled = ref(false);
  const running = ref(false);
  const healthy = ref(false);
  const status = ref<AiServerStatus | null>(null);
  const busy = ref(false);
  const lastError = ref('');

  async function refresh(): Promise<void> {
    bridgeAvailable.value = isAiServerBridgeAvailable();
    enabled.value = await loadAiServerEnabled();
    status.value = await getAiServerStatus();
    running.value = !!status.value?.running;
    const baseUrl = status.value?.baseUrl || (await loadAiServerBaseUrl());
    healthy.value = await co21ApiHealth(baseUrl);
    if (!healthy.value && !running.value) {
      healthy.value = await checkAiServerHealth(baseUrl);
      running.value = healthy.value;
    }
    lastError.value = status.value?.lastError || '';
  }

  async function start(): Promise<boolean> {
    busy.value = true;
    try {
      const result = await startAiServerProcess();
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
      await stopAiServerProcess();
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
    window.addEventListener(AI_SERVER_CHANGED_EVENT, onChanged);
  });

  onUnmounted(() => {
    window.removeEventListener(AI_SERVER_CHANGED_EVENT, onChanged);
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
