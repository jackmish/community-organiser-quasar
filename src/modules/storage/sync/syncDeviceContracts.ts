import CC from 'src/CCAccess';
import { $text } from 'src/modules/lang';
import {
  buildSyncContractPreview,
  type SyncContractPreview,
} from './syncContractPreview';
import {
  isSyncContractActive,
  loadLastContractSnapshot,
  loadPendingIncomingContract,
  loadPendingOutgoingContract,
  snapshotFromPending,
  type SyncContractPending,
  type SyncContractSnapshot,
} from './syncContractSettings';
import { findSendContractAction } from './syncPendingActions';
import {
  loadConnectedDevices,
  loadOwnDeviceMeta,
  mergeLocalDeviceIntoList,
  normalizeDeviceId,
  type ConnectedDevice,
} from './deviceRoleAssignment';
import {
  mergeProfilesForIncomingPreview,
  devicesForIncomingPreview,
} from './syncContractIncoming';
import { loadRoleProfiles } from './roleProfileSettings';

export type DevicePairContractPhase =
  | 'none'
  | 'active'
  | 'awaiting_confirm'
  | 'awaiting_peer'
  | 'sending';

export type MergedDevicePairContract = {
  deviceId: string;
  phase: DevicePairContractPhase;
  statusLabel: string;
  /** Quasar chip/button color hint */
  statusColor: string;
  /** Green pulse — peer sent new rules to accept */
  needsConfirm: boolean;
  hasPreview: boolean;
  canRemove: boolean;
  canResend: boolean;
  incomingPending: SyncContractPending | null;
  effectiveSnapshot: SyncContractSnapshot | null;
  baselineSnapshot: SyncContractSnapshot | null;
  intervalSeconds: number;
  duplicateResolution: SyncContractSnapshot['duplicateResolution'];
};

function phaseLabel(phase: DevicePairContractPhase): string {
  switch (phase) {
    case 'active':
      return $text('sync.contract_status_active');
    case 'awaiting_confirm':
      return $text('sync.contract_status_incoming');
    case 'awaiting_peer':
      return $text('sync.contract_status_awaiting');
    case 'sending':
      return $text('sync.contract_status_sending');
    default:
      return $text('sync.contract_status_none');
  }
}

function phaseColor(phase: DevicePairContractPhase): string {
  switch (phase) {
    case 'active':
      return 'positive';
    case 'awaiting_confirm':
      return 'info';
    case 'awaiting_peer':
      return 'warning';
    case 'sending':
      return 'primary';
    default:
      return 'grey-7';
  }
}

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

function mergeDevices(
  base: SyncContractSnapshot['devices'],
  overlay: SyncContractSnapshot['devices'],
): SyncContractSnapshot['devices'] {
  const byId = new Map(base.map((d) => [normalizeDeviceId(d.id), { ...d, rolesByGroup: { ...d.rolesByGroup } }]));
  for (const d of overlay) {
    const id = normalizeDeviceId(d.id);
    const prev = byId.get(id);
    byId.set(id, {
      id: d.id,
      name: d.name || prev?.name || id,
      rolesByGroup: { ...(prev?.rolesByGroup ?? {}), ...(d.rolesByGroup ?? {}) },
    });
  }
  return [...byId.values()];
}

function mergeRoleProfiles(
  base: SyncContractSnapshot['roleProfiles'],
  overlay: SyncContractSnapshot['roleProfiles'],
): SyncContractSnapshot['roleProfiles'] {
  const byId = new Map(base.map((p) => [p.id, { ...p }]));
  for (const p of overlay) {
    byId.set(p.id, { ...byId.get(p.id), ...p });
  }
  return [...byId.values()];
}

function mergeGroups(
  base: SyncContractSnapshot['groups'],
  overlay: SyncContractSnapshot['groups'],
): NonNullable<SyncContractSnapshot['groups']> {
  const byId = new Map((base ?? []).map((g) => [g.id, { ...g }]));
  for (const g of overlay ?? []) {
    if (!g?.id) continue;
    const prev = byId.get(g.id);
    byId.set(g.id, prev ? { ...prev, ...g, name: g.name || prev.name } : { ...g });
  }
  return [...byId.values()];
}

/** Combine signed baseline with pending overlay (incoming or outgoing) for one device pair. */
export function mergeContractSnapshots(
  baseline: SyncContractSnapshot | null,
  overlay: SyncContractSnapshot,
): SyncContractSnapshot {
  const savedAt = Math.max(baseline?.savedAt ?? 0, overlay.savedAt ?? 0) || Date.now();
  const duplicateResolution =
    overlay.duplicateResolution ?? baseline?.duplicateResolution ?? undefined;
  const groups = mergeGroups(baseline?.groups, overlay.groups);
  return {
    savedAt,
    ...(duplicateResolution !== undefined ? { duplicateResolution } : {}),
    devices: mergeDevices(baseline?.devices ?? [], overlay.devices),
    roleProfiles: mergeRoleProfiles(baseline?.roleProfiles ?? [], overlay.roleProfiles),
    ...(groups.length > 0 ? { groups } : {}),
  };
}

function deviceInSnapshot(snapshot: SyncContractSnapshot | null, deviceId: string): boolean {
  if (!snapshot) return false;
  const norm = normalizeDeviceId(deviceId);
  return snapshot.devices.some((d) => normalizeDeviceId(d.id) === norm);
}

/** Single merged view of all contract layers for this device pair. */
export async function loadMergedDevicePairContract(
  deviceId: string,
): Promise<MergedDevicePairContract> {
  const norm = normalizeDeviceId(deviceId);
  const active = await isSyncContractActive();
  const signed = await loadLastContractSnapshot();
  const incoming = await loadPendingIncomingContract();
  const outgoingStored = await loadPendingOutgoingContract();
  const sendAction = await findSendContractAction();

  const incomingFromPeer =
    incoming && normalizeDeviceId(incoming.proposerDeviceId) === norm ? incoming : null;

  const outgoingPending = outgoingStored ?? sendAction?.pending ?? null;
  const targetsPeer =
    sendAction?.targets.some((t) => normalizeDeviceId(t.deviceId) === norm) ?? false;
  const inOutgoingDevices =
    outgoingPending?.snapshot?.devices?.some(
      (d) => normalizeDeviceId(d.id) === norm,
    ) ?? false;
  const outgoingForPeer =
    outgoingPending && (targetsPeer || inOutgoingDevices) ? outgoingPending : null;

  const baseline =
    signed && deviceInSnapshot(signed, deviceId) ? signed : null;

  let phase: DevicePairContractPhase = 'none';
  let effective: SyncContractSnapshot | null = null;
  let intervalSeconds = 60;
  let duplicateResolution = signed?.duplicateResolution;

  if (incomingFromPeer) {
    phase = 'awaiting_confirm';
    effective = mergeContractSnapshots(baseline, incomingFromPeer.snapshot);
    intervalSeconds =
      incomingFromPeer.intervalSeconds ?? sendAction?.intervalSeconds ?? 60;
    duplicateResolution =
      incomingFromPeer.duplicateResolution ??
      incomingFromPeer.snapshot.duplicateResolution ??
      duplicateResolution;
  } else if (outgoingForPeer) {
    phase = sendAction?.deliveredAt ? 'awaiting_peer' : 'sending';
    const overlay = snapshotFromPending(outgoingForPeer);
    effective = mergeContractSnapshots(baseline, overlay);
    intervalSeconds = outgoingForPeer.intervalSeconds ?? sendAction?.intervalSeconds ?? 60;
    duplicateResolution =
      outgoingForPeer.duplicateResolution ?? overlay.duplicateResolution ?? duplicateResolution;
  } else if (active && baseline) {
    phase = 'active';
    effective = baseline;
  }

  const hasPreview = !!effective;
  const needsConfirm = !!incomingFromPeer;

  return {
    deviceId,
    phase,
    statusLabel: phaseLabel(phase),
    statusColor: phaseColor(phase),
    needsConfirm,
    hasPreview,
    canRemove: phase !== 'none',
    canResend: phase === 'active' || phase === 'awaiting_peer' || phase === 'sending' || phase === 'none',
    incomingPending: incomingFromPeer,
    effectiveSnapshot: effective,
    baselineSnapshot: baseline,
    intervalSeconds,
    duplicateResolution,
  };
}

export async function buildMergedPairPreview(
  deviceId: string,
): Promise<{
  preview: SyncContractPreview | null;
  merged: MergedDevicePairContract;
  devices: ConnectedDevice[];
  profiles: Awaited<ReturnType<typeof loadRoleProfiles>>;
}> {
  const merged = await loadMergedDevicePairContract(deviceId);
  if (!merged.effectiveSnapshot) {
    return { preview: null, merged, devices: [], profiles: [] };
  }

  const profiles = await loadRoleProfiles();
  const local = await loadOwnDeviceMeta();
  const loaded = await loadConnectedDevices();
  const devices = mergeLocalDeviceIntoList(loaded, local);

  const current = merged.effectiveSnapshot;
  const previous = merged.baselineSnapshot;

  let previewDevices = devices;
  let previewProfiles = profiles;

  if (merged.incomingPending) {
    previewDevices = devicesForIncomingPreview(devices, merged.incomingPending.snapshot);
    previewProfiles = mergeProfilesForIncomingPreview(profiles, merged.incomingPending.snapshot);
  }

  const preview = buildSyncContractPreview(
    previous,
    current,
    previewDevices,
    previewProfiles,
    CC.group?.list?.all?.value ?? [],
    countTasksByGroup(),
    { includeAllDevicesInSections: true },
  );

  return { preview, merged, devices: previewDevices, profiles: previewProfiles };
}
