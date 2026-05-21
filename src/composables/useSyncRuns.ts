import { onBeforeUnmount, onMounted, ref } from 'vue';
import { loadSyncRuns, SYNC_RUNS_CHANGED_EVENT, type SyncRunRecord } from 'src/modules/storage/sync/syncRunQueue';

export function useSyncRuns() {
  const runs = ref<SyncRunRecord[]>([]);

  async function refresh(): Promise<void> {
    runs.value = await loadSyncRuns();
  }

  const onChanged = () => {
    void refresh();
  };

  onMounted(() => {
    void refresh();
    window.addEventListener(SYNC_RUNS_CHANGED_EVENT, onChanged);
    window.addEventListener('co21:sync-contract-signed', onChanged);
  });

  onBeforeUnmount(() => {
    window.removeEventListener(SYNC_RUNS_CHANGED_EVENT, onChanged);
    window.removeEventListener('co21:sync-contract-signed', onChanged);
  });

  return { runs, refresh };
}
