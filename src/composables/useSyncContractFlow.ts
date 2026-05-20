import { ref } from 'vue';
import CC from 'src/CCAccess';
import type { PrivilegeChange } from 'src/modules/storage/sync/RoleModel';
import type { RoleProfileData } from 'src/modules/storage/sync/RoleProfileModel';
import { loadRoleProfiles } from 'src/modules/storage/sync/roleProfileSettings';
import {
  buildSyncContractPreview,
  buildSyncContractSnapshot,
  hasSnapshotChanges,
  type SyncContractPreview,
} from 'src/modules/storage/sync/syncContractPreview';
import {
  DEFAULT_SYNC_INTERVAL_SECONDS,
  DEFAULT_SYNC_DUPLICATE_RESOLUTION,
  loadSyncDuplicateResolution,
  normalizeSyncDuplicateResolution,
  type SyncContractSnapshot,
  type SyncDuplicateResolution,
} from 'src/modules/storage/sync/syncContractSettings';
import {
  loadConnectedDevices,
  loadOwnDeviceMeta,
  mergeLocalDeviceIntoList,
  type ConnectedDevice,
} from 'src/modules/storage/sync/deviceRoleAssignment';

export function useSyncContractFlow() {
  const showConfirmDialog = ref(false);
  const showPreviewDialog = ref(false);
  const showPrivilegeDialog = ref(false);
  const showPeerAcceptDialog = ref(false);

  const preview = ref<SyncContractPreview | null>(null);
  const pendingSnapshot = ref<SyncContractSnapshot | null>(null);
  const privilegeChanges = ref<PrivilegeChange[]>([]);
  const confirmIntervalSeconds = ref(DEFAULT_SYNC_INTERVAL_SECONDS);
  const confirmDuplicateResolution = ref<SyncDuplicateResolution>(DEFAULT_SYNC_DUPLICATE_RESOLUTION);

  let baselineSnapshot: SyncContractSnapshot | null = null;

  function countTasksByGroup(): Record<string, number> {
    const out: Record<string, number> = {};
    try {
      const items = CC.task?.list?.items?.() ?? [];
      for (const t of items) {
        const gid = String((t as { groupId?: string }).groupId ?? '');
        if (gid) out[gid] = (out[gid] ?? 0) + 1;
      }
    } catch {
      void 0;
    }
    return out;
  }

  async function loadDevicesAndProfiles(): Promise<{
    devices: ConnectedDevice[];
    profiles: RoleProfileData[];
  }> {
    const profiles = await loadRoleProfiles();
    const local = await loadOwnDeviceMeta();
    const loaded = await loadConnectedDevices();
    const devices = mergeLocalDeviceIntoList(loaded, local);
    return { devices, profiles };
  }

  function captureBaselineFrom(
    devices: ConnectedDevice[],
    profiles: RoleProfileData[],
    baseline?: SyncContractSnapshot | null,
  ): void {
    baselineSnapshot =
      baseline ??
      buildSyncContractSnapshot(devices, profiles, confirmDuplicateResolution.value);
  }

  async function captureBaseline(): Promise<void> {
    const { devices, profiles } = await loadDevicesAndProfiles();
    captureBaselineFrom(devices, profiles);
  }

  function hasChanges(devices: ConnectedDevice[], profiles: RoleProfileData[]): boolean {
    const current = buildSyncContractSnapshot(
      devices,
      profiles,
      confirmDuplicateResolution.value,
    );
    return hasSnapshotChanges(baselineSnapshot, current);
  }

  function defaultIntervalFromDevices(devices: ConnectedDevice[]): number {
    const remote = devices.filter((d) => !d.isLocal);
    const first = remote.find((d) => typeof d.syncIntervalSeconds === 'number');
    return first?.syncIntervalSeconds ?? DEFAULT_SYNC_INTERVAL_SECONDS;
  }

  function prepareConfirmation(
    devices: ConnectedDevice[],
    profiles: RoleProfileData[],
    intervalSeconds?: number,
  ): boolean {
    const current = buildSyncContractSnapshot(
      devices,
      profiles,
      confirmDuplicateResolution.value,
    );
    const previous = baselineSnapshot;
    if (!hasSnapshotChanges(previous, current)) {
      return false;
    }

    const built = buildSyncContractPreview(
      previous,
      current,
      devices,
      profiles,
      CC.group?.list?.all?.value ?? [],
      countTasksByGroup(),
    );

    pendingSnapshot.value = current;
    preview.value = built;
    privilegeChanges.value = built.privilegeChanges;
    confirmIntervalSeconds.value = intervalSeconds ?? defaultIntervalFromDevices(devices);
    return true;
  }

  async function initDuplicateResolutionFromSettings(): Promise<void> {
    confirmDuplicateResolution.value = await loadSyncDuplicateResolution();
  }

  function setDuplicateResolution(mode: SyncDuplicateResolution): void {
    const v = normalizeSyncDuplicateResolution(mode);
    confirmDuplicateResolution.value = v;
    if (pendingSnapshot.value) {
      pendingSnapshot.value = { ...pendingSnapshot.value, duplicateResolution: v };
    }
  }

  /** User tapped confirm — privilege step (if needed), then preview. */
  async function beginConfirmation(
    devices: ConnectedDevice[],
    profiles: RoleProfileData[],
    intervalSeconds?: number,
  ): Promise<boolean> {
    await initDuplicateResolutionFromSettings();
    if (!prepareConfirmation(devices, profiles, intervalSeconds)) {
      return false;
    }
    if (privilegeChanges.value.length) {
      showPrivilegeDialog.value = true;
      return true;
    }
    showPreviewDialog.value = true;
    return true;
  }

  function onPrivilegeDialogConfirm(): void {
    showPrivilegeDialog.value = false;
    showPreviewDialog.value = true;
  }

  function onPrivilegeDialogCancel(): void {
    showPrivilegeDialog.value = false;
    pendingSnapshot.value = null;
    preview.value = null;
  }

  function onConfirmRules(): void {
    showConfirmDialog.value = false;
    showPreviewDialog.value = true;
  }

  function onCancelConfirm(): void {
    showConfirmDialog.value = false;
    pendingSnapshot.value = null;
    preview.value = null;
  }

  /** User accepted preview — queue delivery; do not advance baseline until peer signs or cancel. */
  function onPreviewAcceptedPending(): void {
    showPreviewDialog.value = false;
    showPeerAcceptDialog.value = false;
    pendingSnapshot.value = null;
    preview.value = null;
  }

  function getBaselineSnapshot(): SyncContractSnapshot | null {
    return baselineSnapshot;
  }

  function restoreBaseline(snapshot: SyncContractSnapshot | null): void {
    baselineSnapshot = snapshot;
  }

  /** Legacy: peer accepted on proposer side — advance baseline to last signed contract. */
  function onPreviewAccepted(): void {
    showPreviewDialog.value = false;
    showPeerAcceptDialog.value = false;
    if (pendingSnapshot.value) {
      baselineSnapshot = pendingSnapshot.value;
    }
    pendingSnapshot.value = null;
    preview.value = null;
  }

  function onPreviewCancelled(): void {
    showPreviewDialog.value = false;
    pendingSnapshot.value = null;
    preview.value = null;
  }

  function onPeerContractSigned(): void {
    showPeerAcceptDialog.value = false;
    pendingSnapshot.value = null;
    preview.value = null;
  }

  return {
    showConfirmDialog,
    showPreviewDialog,
    showPrivilegeDialog,
    showPeerAcceptDialog,
    preview,
    pendingSnapshot,
    privilegeChanges,
    confirmIntervalSeconds,
    confirmDuplicateResolution,
    setDuplicateResolution,
    initDuplicateResolutionFromSettings,
    captureBaseline,
    captureBaselineFrom,
    hasChanges,
    beginConfirmation,
    onPrivilegeDialogConfirm,
    onPrivilegeDialogCancel,
    onConfirmRules,
    onCancelConfirm,
    onPreviewAccepted,
    onPreviewAcceptedPending,
    getBaselineSnapshot,
    restoreBaseline,
    onPreviewCancelled,
    onPeerContractSigned,
  };
}
