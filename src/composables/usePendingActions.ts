import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import {
  cancelPendingAction,
  loadPendingActions,
  PENDING_ACTIONS_CHANGED_EVENT,
  pendingActionsCount,
  runPendingActionNow,
  type SyncPendingAction,
} from 'src/modules/storage/sync/syncPendingActions';
import {
  loadConnectedDevices,
  loadOwnDeviceMeta,
  mergeLocalDeviceIntoList,
  type ConnectedDevice,
} from 'src/modules/storage/sync/deviceRoleAssignment';

export function usePendingActions() {
  const actions = ref<SyncPendingAction[]>([]);
  const count = computed(() => actions.value.length);
  const hasPending = computed(() => count.value > 0);

  async function refresh(): Promise<void> {
    actions.value = await loadPendingActions();
  }

  async function loadDevices(): Promise<ConnectedDevice[]> {
    const local = await loadOwnDeviceMeta();
    const loaded = await loadConnectedDevices();
    return mergeLocalDeviceIntoList(loaded, local);
  }

  async function runNow(actionId: string): Promise<boolean> {
    const devices = await loadDevices();
    return runPendingActionNow(actionId, devices);
  }

  const onChange = () => void refresh();

  onMounted(() => {
    void refresh();
    window.addEventListener(PENDING_ACTIONS_CHANGED_EVENT, onChange);
    window.addEventListener('co21:sync-contract-signed', onChange);
  });

  onBeforeUnmount(() => {
    window.removeEventListener(PENDING_ACTIONS_CHANGED_EVENT, onChange);
    window.removeEventListener('co21:sync-contract-signed', onChange);
  });

  return {
    actions,
    count,
    hasPending,
    refresh,
    runNow,
    cancelPendingAction,
    pendingActionsCount,
  };
}
