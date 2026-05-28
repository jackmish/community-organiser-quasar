import { Notify } from 'quasar';
import { $text } from 'src/modules/lang';
import { co21LanBaseUrl } from 'src/modules/lan/lanPairingConstants';
import {
  lanPostSyncContractAccept,
  lanPostSyncContractReject,
} from 'src/modules/lan/lanSyncContract';
import { applyContractSnapshotGroupsToOrganiser } from './syncContractGroups';
import { applyContractSnapshotToLocalRegistry } from './syncContractApply';
import {
  dispatchSyncContractIncoming,
  resolveProposerLanHost,
} from './syncContractIncoming';
import {
  loadPendingIncomingContract,
  saveLastContractSnapshot,
  savePendingIncomingContract,
  savePendingOutgoingContract,
  saveSyncDuplicateResolution,
  normalizeSyncDuplicateResolution,
  type SyncContractPending,
  type SyncDuplicateResolution,
} from './syncContractSettings';
import { setSyncContractRuntime } from './syncContractRuntime';
import { ensurePeerSyncSession } from './syncPeerState';
import { runFirstSyncAfterContractAccept } from './lanOrganiserSync';
import { loadOwnDeviceMeta } from './deviceRoleAssignment';
import logger from 'src/utils/logger';

/** Notify proposer that this device accepted (used for accept-delivery retry). */
export async function notifyProposerContractAccepted(
  pending: SyncContractPending,
): Promise<boolean> {
  const local = await loadOwnDeviceMeta();
  const host = await resolveProposerLanHost(pending);
  const base = host ? co21LanBaseUrl(host) : '';
  if (!base) return false;
  return lanPostSyncContractAccept(base, {
    acceptorDeviceId: local.id,
    acceptorDeviceName: local.name,
    proposerDeviceId: pending.proposerDeviceId,
    createdAt: pending.createdAt,
  });
}

export type AcceptPendingIncomingResult = {
  ok: boolean;
  /** LAN notify to proposer failed — caller may retry with `pending`. */
  notifyOk: boolean;
  pending: SyncContractPending | null;
};

/** Apply and sign the pending incoming LAN contract (acceptor side). */
export async function acceptPendingIncomingContract(opts: {
  duplicateResolution: SyncDuplicateResolution;
  intervalSeconds?: number;
}): Promise<AcceptPendingIncomingResult> {
  let pending = await loadPendingIncomingContract();
  if (!pending?.snapshot) {
    return { ok: false, notifyOk: false, pending: null };
  }

  if (opts.intervalSeconds != null) {
    pending = { ...pending, intervalSeconds: opts.intervalSeconds };
    await savePendingIncomingContract(pending);
  }

  await saveSyncDuplicateResolution(opts.duplicateResolution);
  const savedSnapshot = {
    ...pending.snapshot,
    duplicateResolution: normalizeSyncDuplicateResolution(opts.duplicateResolution),
  };
  const token = pending.syncSessionToken;

  await applyContractSnapshotGroupsToOrganiser(savedSnapshot);
  await applyContractSnapshotToLocalRegistry(savedSnapshot);
  await saveLastContractSnapshot(savedSnapshot);
  setSyncContractRuntime(savedSnapshot);
  await ensurePeerSyncSession(pending.proposerDeviceId, pending.proposerDeviceName, token);
  await savePendingOutgoingContract(null);
  await savePendingIncomingContract(null);
  dispatchSyncContractIncoming();

  Notify.create({
    type: 'positive',
    message: $text('sync.contract_signed_ok'),
    timeout: 2500,
  });
  window.dispatchEvent(new Event('co21:sync-contract-signed'));

  const notifyOk = await notifyProposerContractAccepted(pending);
  if (!notifyOk) {
    logger.warn('[syncContractAccept] accept notify to proposer failed');
  }

  void runFirstSyncAfterContractAccept(token);
  return { ok: true, notifyOk, pending: notifyOk ? null : pending };
}

/** Reject the pending incoming contract and notify the proposer when possible. */
export async function rejectPendingIncomingContract(): Promise<boolean> {
  const pending = await loadPendingIncomingContract();
  if (!pending) return false;

  const local = await loadOwnDeviceMeta();
  const host = await resolveProposerLanHost(pending);
  const base = host ? co21LanBaseUrl(host) : '';
  if (base) {
    const ok = await lanPostSyncContractReject(base, {
      rejectorDeviceId: local.id,
      rejectorDeviceName: local.name,
      proposerDeviceId: pending.proposerDeviceId,
      createdAt: pending.createdAt,
    });
    if (!ok) {
      Notify.create({
        type: 'warning',
        message: $text('sync.contract_reject_notify_fail'),
        timeout: 3500,
      });
    }
  } else {
    Notify.create({
      type: 'warning',
      message: $text('sync.missing_lan_host').replace(
        '{names}',
        pending.proposerDeviceName || '?',
      ),
      timeout: 3500,
    });
  }

  await savePendingIncomingContract(null);
  dispatchSyncContractIncoming();
  Notify.create({
    type: 'info',
    message: $text('sync.contract_rejected_local'),
    timeout: 2500,
  });
  return true;
}
