import CC from 'src/CCAccess';
import type { AccessRange, RolePrivilege } from './RoleModel';
import type { RoleFunctionId } from './roleFunctionCatalog';
import type { RoleProfileData } from './RoleProfileModel';
import { syncFunctionAccess } from './roleFunctionCatalog';
import {
  buildSyncContractPreview,
  type SyncContractPreview,
} from './syncContractPreview';
import type { SyncContractSnapshot } from './syncContractSettings';
import {
  loadLastContractSnapshot,
  loadPendingIncomingContract,
  type SyncContractPending,
} from './syncContractSettings';
import {
  loadConnectedDevices,
  loadOwnDeviceMeta,
  mergeLocalDeviceIntoList,
  type ConnectedDevice,
} from './deviceRoleAssignment';
import { loadRoleProfiles } from './roleProfileSettings';

export const SYNC_CONTRACT_INCOMING_EVENT = 'co21:sync-contract-incoming';
export const OPEN_INCOMING_SYNC_REVIEW_EVENT = 'co21:open-incoming-sync-review';

export function dispatchSyncContractIncoming(): void {
  window.dispatchEvent(new Event(SYNC_CONTRACT_INCOMING_EVENT));
}

export function dispatchOpenIncomingReview(): void {
  window.dispatchEvent(new Event(OPEN_INCOMING_SYNC_REVIEW_EVENT));
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

export function devicesForIncomingPreview(
  localDevices: ConnectedDevice[],
  snapshot: SyncContractSnapshot,
): ConnectedDevice[] {
  const localById = new Map(localDevices.map((d) => [d.id, d]));
  const out = localDevices.map((d) => {
    if (d.isLocal) return d;
    const s = snapshot.devices.find((x) => x.id === d.id);
    if (!s) return d;
    return { ...d, name: s.name || d.name, rolesByGroup: { ...s.rolesByGroup } };
  });
  for (const s of snapshot.devices) {
    if (!localById.has(s.id)) {
      out.push({ id: s.id, name: s.name, rolesByGroup: { ...s.rolesByGroup } });
    }
  }
  return out;
}

export function mergeProfilesForIncomingPreview(
  local: RoleProfileData[],
  snapshot: SyncContractSnapshot,
): RoleProfileData[] {
  const byId = new Map(local.map((p) => [p.id, p]));
  for (const sp of snapshot.roleProfiles) {
    const existing = byId.get(sp.id);
    byId.set(sp.id, {
      id: sp.id,
      name: sp.name,
      accessRange: sp.accessRange as AccessRange,
      functionAccess: syncFunctionAccess(
        sp.functionAccess.map((f) => ({
          functionId: f.functionId as RoleFunctionId,
          enabled: !!f.enabled,
          privilege: f.privilege as RolePrivilege,
        })),
      ),
      createdAt: existing?.createdAt ?? sp.updatedAt,
      updatedAt: sp.updatedAt,
    });
  }
  return [...byId.values()];
}

export async function loadIncomingBannerState(): Promise<{
  pending: SyncContractPending | null;
  showBanner: boolean;
}> {
  const incoming = await loadPendingIncomingContract();
  if (!incoming) return { pending: null, showBanner: false };
  // Always surface peer contracts in the header (local outgoing queue is separate).
  return { pending: incoming, showBanner: true };
}

export async function buildIncomingContractPreview(
  pending: SyncContractPending,
): Promise<SyncContractPreview> {
  const profiles = await loadRoleProfiles();
  const local = await loadOwnDeviceMeta();
  const loaded = await loadConnectedDevices();
  const devices = mergeLocalDeviceIntoList(loaded, local);
  const mergedDevices = devicesForIncomingPreview(devices, pending.snapshot);
  const mergedProfiles = mergeProfilesForIncomingPreview(profiles, pending.snapshot);
  const previous = await loadLastContractSnapshot();
  return buildSyncContractPreview(
    previous,
    pending.snapshot,
    mergedDevices,
    mergedProfiles,
    CC.group?.list?.all?.value ?? [],
    countTasksByGroup(),
  );
}
