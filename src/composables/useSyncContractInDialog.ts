import type { Ref } from 'vue';
import { computed } from 'vue';
import { useSyncContractFlow } from 'src/composables/useSyncContractFlow';
import { pushSyncContractToLanPeers } from 'src/modules/lan/lanSyncContract';
import {
  loadLastContractSnapshot,
  savePendingOutgoingContract,
} from 'src/modules/storage/sync/syncContractSettings';
import {
  DEFAULT_SYNC_INTERVAL_SECONDS,
  MIN_SYNC_INTERVAL_SECONDS,
  MAX_SYNC_INTERVAL_SECONDS,
} from 'src/modules/storage/sync/syncContractSettings';
import { loadOwnDeviceMeta, type ConnectedDevice } from 'src/modules/storage/sync/deviceRoleAssignment';
import type { RoleProfileData } from 'src/modules/storage/sync/RoleProfileModel';

/** Sync contract UI wired inside Connections or Join Member dialogs. */
export function useSyncContractInDialog(
  devices: Ref<ConnectedDevice[]>,
  roleProfiles: Ref<RoleProfileData[]>,
) {
  const sync = useSyncContractFlow();

  const hasPendingChanges = computed(() =>
    sync.hasChanges(devices.value, roleProfiles.value),
  );

  async function captureBaseline(): Promise<void> {
    const last = await loadLastContractSnapshot();
    sync.captureBaselineFrom(devices.value, roleProfiles.value, last);
  }

  function startConfirmChanges(): void {
    sync.beginConfirmation(devices.value, roleProfiles.value);
  }

  function applyIntervalToRemoteDevices(seconds: number): void {
    const v = Math.min(
      MAX_SYNC_INTERVAL_SECONDS,
      Math.max(MIN_SYNC_INTERVAL_SECONDS, Math.floor(seconds)),
    );
    devices.value = devices.value.map((d) =>
      d.isLocal ? d : { ...d, syncIntervalSeconds: v },
    );
  }

  async function onPreviewConfirm(): Promise<void> {
    applyIntervalToRemoteDevices(sync.confirmIntervalSeconds.value);
    const snap = sync.pendingSnapshot.value;
    const local = await loadOwnDeviceMeta();
    if (snap) {
      const pending = {
        createdAt: Date.now(),
        snapshot: snap,
        proposerDeviceId: local.id,
        proposerDeviceName: local.name,
      };
      await savePendingOutgoingContract(pending);
      await pushSyncContractToLanPeers(devices.value, pending);
    }
    sync.onPreviewAccepted();
  }

  return {
    showPreviewDialog: sync.showPreviewDialog,
    showPrivilegeDialog: sync.showPrivilegeDialog,
    showPeerAcceptDialog: sync.showPeerAcceptDialog,
    preview: sync.preview,
    privilegeChanges: sync.privilegeChanges,
    confirmIntervalSeconds: sync.confirmIntervalSeconds,
    hasPendingChanges,
    captureBaseline,
    startConfirmChanges,
    applyIntervalToRemoteDevices,
    onPreviewConfirm,
    onPrivilegeDialogConfirm: sync.onPrivilegeDialogConfirm,
    onPrivilegeDialogCancel: sync.onPrivilegeDialogCancel,
    onPreviewCancelled: sync.onPreviewCancelled,
    onPeerContractSigned: sync.onPeerContractSigned,
    minSyncInterval: MIN_SYNC_INTERVAL_SECONDS,
    maxSyncInterval: MAX_SYNC_INTERVAL_SECONDS,
    defaultSyncInterval: DEFAULT_SYNC_INTERVAL_SECONDS,
  };
}
