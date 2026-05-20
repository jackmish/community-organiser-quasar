import type { Ref } from 'vue';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useSyncContractFlow } from 'src/composables/useSyncContractFlow';
import {
  createSendContractAction,
  findSendContractAction,
  PENDING_ACTIONS_CHANGED_EVENT,
  tryDeliverAction,
} from 'src/modules/storage/sync/syncPendingActions';
import { refreshLanServerForConnections } from 'src/modules/lan/lanServerManager';
import { remoteDevicesMissingLanHost } from 'src/modules/lan/lanSyncContract';
import { appNotify } from 'src/utils/appNotify';
import { $text } from 'src/modules/lang';
import { SYNC_BASELINE_RESTORE_EVENT } from 'src/modules/storage/sync/syncContractUi';
import {
  loadLastContractSnapshot,
  normalizeSyncDuplicateResolution,
  saveSyncDuplicateResolution,
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
  const hasPendingSendAction = ref(false);

  async function refreshPendingSend(): Promise<void> {
    hasPendingSendAction.value = !!(await findSendContractAction());
  }

  const hasPendingChanges = computed(() => {
    if (hasPendingSendAction.value) return false;
    return sync.hasChanges(devices.value, roleProfiles.value);
  });

  async function captureBaseline(): Promise<void> {
    const last = await loadLastContractSnapshot();
    if (last?.duplicateResolution) {
      sync.confirmDuplicateResolution.value = normalizeSyncDuplicateResolution(
        last.duplicateResolution,
      );
    } else {
      await sync.initDuplicateResolutionFromSettings();
    }
    sync.captureBaselineFrom(devices.value, roleProfiles.value, last);
  }

  async function startConfirmChanges(): Promise<void> {
    await sync.beginConfirmation(devices.value, roleProfiles.value);
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
    await saveSyncDuplicateResolution(sync.confirmDuplicateResolution.value);

    const local = await loadOwnDeviceMeta();
    const ownLabel = devices.value.find((d) => d.isLocal)?.name || local.name;
    devices.value = await refreshLanServerForConnections(devices.value, ownLabel);

    const missingHost = remoteDevicesMissingLanHost(devices.value);
    if (missingHost.length) {
      appNotify(
        'warning',
        $text('sync.missing_lan_host').replace(
          '{names}',
          missingHost.map((d) => d.name).join(', '),
        ),
      );
    }

    const snap = sync.pendingSnapshot.value;
    if (snap) {
      const preAccept = sync.getBaselineSnapshot();
      const pending = {
        createdAt: Date.now(),
        snapshot: snap,
        proposerDeviceId: local.id,
        proposerDeviceName: local.name,
      };
      const action = await createSendContractAction({
        pending,
        intervalSeconds: sync.confirmIntervalSeconds.value,
        duplicateResolution: sync.confirmDuplicateResolution.value,
        devices: devices.value,
        preAcceptBaseline: preAccept,
      });
      const delivered = await tryDeliverAction(action, devices.value, { skipReconcile: true });
      if (!delivered) {
        appNotify('warning', $text('sync.lan_delivery_failed'));
      }
    }
    sync.onPreviewAcceptedPending();
    await refreshPendingSend();
  }

  function onBaselineRestore(ev: Event): void {
    const detail = (ev as CustomEvent<{ baseline: unknown }>).detail;
    sync.restoreBaseline(
      detail?.baseline && typeof detail.baseline === 'object'
        ? (detail.baseline as ReturnType<typeof sync.getBaselineSnapshot>)
        : null,
    );
    void refreshPendingSend();
  }

  const onPendingChanged = () => void refreshPendingSend();

  onMounted(() => {
    void refreshPendingSend();
    window.addEventListener(PENDING_ACTIONS_CHANGED_EVENT, onPendingChanged);
    window.addEventListener(SYNC_BASELINE_RESTORE_EVENT, onBaselineRestore);
  });

  onBeforeUnmount(() => {
    window.removeEventListener(PENDING_ACTIONS_CHANGED_EVENT, onPendingChanged);
    window.removeEventListener(SYNC_BASELINE_RESTORE_EVENT, onBaselineRestore);
  });

  return {
    showPreviewDialog: sync.showPreviewDialog,
    showPrivilegeDialog: sync.showPrivilegeDialog,
    showPeerAcceptDialog: sync.showPeerAcceptDialog,
    preview: sync.preview,
    privilegeChanges: sync.privilegeChanges,
    confirmIntervalSeconds: sync.confirmIntervalSeconds,
    confirmDuplicateResolution: sync.confirmDuplicateResolution,
    setDuplicateResolution: sync.setDuplicateResolution,
    hasPendingChanges,
    hasPendingSendAction,
    refreshPendingSend,
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
