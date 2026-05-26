import { patchCo21Settings, loadCo21Settings } from './roleProfileSettings';
import type { ConnectedDevice } from './deviceRoleAssignment';
import { loadOwnDeviceMeta, saveConnectedDevices } from './deviceRoleAssignment';
import { loadConnectionsDevices } from './connectionsDeviceStorage';
import { reconcileLanDeviceIds } from 'src/modules/lan/lanDeviceReconcile';
import { createLanSyncToken } from 'src/modules/lan/lanSyncAuth';
import { pushSyncContractToLanPeers } from 'src/modules/lan/lanSyncContract';
import { prepareRemotesForLanOps } from 'src/modules/lan/lanRemoteHost';
import { syncLanTrustedContractDevices } from 'src/modules/lan/lanServerManager';
import logger from 'src/utils/logger';
import {
  normalizeSyncDuplicateResolution,
  loadPendingOutgoingContract,
  savePendingOutgoingContract,
  saveLastContractSnapshot,
  type SyncContractPending,
  type SyncContractSnapshot,
  type SyncDuplicateResolution,
} from './syncContractSettings';

export const PENDING_ACTIONS_CHANGED_EVENT = 'co21:pending-actions-changed';
export const OPEN_PENDING_ACTIONS_EVENT = 'co21:open-pending-actions';

export type SyncPendingActionKind = 'send_contract';

export type SyncPendingActionTarget = {
  deviceId: string;
  deviceName: string;
  lanHost?: string;
};

export type SyncPendingAction = {
  id: string;
  kind: SyncPendingActionKind;
  createdAt: number;
  intervalSeconds: number;
  duplicateResolution: SyncDuplicateResolution;
  pending: SyncContractPending;
  targets: SyncPendingActionTarget[];
  /** Baseline before user accepted — restored on cancel. */
  preAcceptBaseline: SyncContractSnapshot | null;
  lastAttemptAt?: number;
  /** Set when at least one LAN delivery succeeded. */
  deliveredAt?: number;
  /** Failed LAN delivery attempts (device offline / out of range). */
  deliveryFailCount?: number;
};

export function dispatchPendingActionsChanged(): void {
  window.dispatchEvent(new Event(PENDING_ACTIONS_CHANGED_EVENT));
}

function targetsFromDevices(devices: ConnectedDevice[]): SyncPendingActionTarget[] {
  return devices
    .filter((d) => !d.isLocal)
    .map((d) => ({
      deviceId: d.id,
      deviceName: d.name,
      ...(d.lanHost ? { lanHost: d.lanHost } : {}),
    }));
}

function normalizeAction(raw: unknown): SyncPendingAction | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as SyncPendingAction;
  if (o.kind !== 'send_contract' || typeof o.id !== 'string' || !o.pending?.snapshot) return null;
  return {
    id: o.id,
    kind: 'send_contract',
    createdAt: typeof o.createdAt === 'number' ? o.createdAt : Date.now(),
    intervalSeconds: Math.max(15, Math.floor(Number(o.intervalSeconds) || 60)),
    duplicateResolution: normalizeSyncDuplicateResolution(o.duplicateResolution),
    pending: o.pending,
    targets: Array.isArray(o.targets) ? o.targets : [],
    preAcceptBaseline:
      o.preAcceptBaseline && typeof o.preAcceptBaseline === 'object'
        ? o.preAcceptBaseline
        : null,
    ...(typeof o.lastAttemptAt === 'number' ? { lastAttemptAt: o.lastAttemptAt } : {}),
    ...(typeof o.deliveredAt === 'number' ? { deliveredAt: o.deliveredAt } : {}),
    ...(typeof o.deliveryFailCount === 'number' && o.deliveryFailCount > 0
      ? { deliveryFailCount: Math.floor(o.deliveryFailCount) }
      : {}),
  };
}

export async function loadPendingActions(): Promise<SyncPendingAction[]> {
  const data = await loadCo21Settings();
  const raw = data.syncPendingActions;
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeAction).filter((a): a is SyncPendingAction => !!a);
}

export async function savePendingActions(actions: SyncPendingAction[]): Promise<boolean> {
  return patchCo21Settings({ syncPendingActions: actions });
}

export async function pendingActionsCount(): Promise<number> {
  return (await loadPendingActions()).length;
}

export async function hasPendingSendContractAction(): Promise<boolean> {
  return (await pendingActionsCount()) > 0;
}

function enrichPending(
  pending: SyncContractPending,
  intervalSeconds: number,
  duplicateResolution: SyncDuplicateResolution,
): SyncContractPending {
  return {
    ...pending,
    intervalSeconds,
    duplicateResolution,
    syncSessionToken: pending.syncSessionToken || createLanSyncToken(),
  };
}

/** Create queued send-contract action (does not advance sync baseline). */
export async function createSendContractAction(opts: {
  pending: SyncContractPending;
  intervalSeconds: number;
  duplicateResolution: SyncDuplicateResolution;
  devices: ConnectedDevice[];
  preAcceptBaseline: SyncContractSnapshot | null;
}): Promise<SyncPendingAction> {
  const enriched = enrichPending(
    opts.pending,
    opts.intervalSeconds,
    opts.duplicateResolution,
  );
  const action: SyncPendingAction = {
    id: crypto.randomUUID(),
    kind: 'send_contract',
    createdAt: Date.now(),
    intervalSeconds: opts.intervalSeconds,
    duplicateResolution: opts.duplicateResolution,
    pending: enriched,
    targets: targetsFromDevices(opts.devices),
    preAcceptBaseline: opts.preAcceptBaseline,
  };
  const list = await loadPendingActions();
  const next = list.filter((a) => a.kind !== 'send_contract');
  next.push(action);
  await savePendingActions(next);
  await savePendingOutgoingContract(enriched);
  dispatchPendingActionsChanged();
  return action;
}

export async function findSendContractAction(): Promise<SyncPendingAction | null> {
  const list = await loadPendingActions();
  return list.find((a) => a.kind === 'send_contract') ?? null;
}

let promotionInProgress = false;

/**
 * After a successful sync exchange, promote the outgoing pending contract
 * to a saved (accepted) contract and remove the send_contract action.
 * This is the implicit "peer accepted" signal.
 */
export async function promoteOutgoingContractIfNeeded(): Promise<boolean> {
  if (promotionInProgress) return false;
  promotionInProgress = true;
  try {
    const outgoing = await loadPendingOutgoingContract();
    if (!outgoing?.snapshot) return false;
    const action = await findSendContractAction();
    if (!action) return false;
    await saveLastContractSnapshot({
      ...outgoing.snapshot,
      ...(outgoing.duplicateResolution
        ? { duplicateResolution: outgoing.duplicateResolution }
        : {}),
    });
    await savePendingOutgoingContract(null);
    const list = await loadPendingActions();
    await savePendingActions(list.filter((a) => a.kind !== 'send_contract'));
    dispatchPendingActionsChanged();
    window.dispatchEvent(new Event('co21:sync-contract-signed'));
    logger.info('[syncPendingActions] outgoing contract promoted — peer accepted');
    return true;
  } catch (e) {
    logger.warn('[syncPendingActions] promoteOutgoingContract failed', e);
    return false;
  } finally {
    promotionInProgress = false;
  }
}

export async function tryDeliverAction(
  action: SyncPendingAction,
  _devices: ConnectedDevice[],
  opts?: { skipReconcile?: boolean },
): Promise<boolean> {
  let rows = await loadConnectionsDevices();
  if (!opts?.skipReconcile) {
    const { devices: reconciled, repaired } = await reconcileLanDeviceIds(rows);
    if (repaired.length > 0) {
      await saveConnectedDevices(reconciled);
      await syncLanTrustedContractDevices(reconciled);
    }
    rows = reconciled;
  }
  const deviceRows = await prepareRemotesForLanOps({ persistHosts: true, devices: rows });
  if (!deviceRows.length) {
    logger.warn('[syncPendingActions] no remote peer with LAN host — cannot deliver to PC');
    const now = Date.now();
    const list = await loadPendingActions();
    const idx = list.findIndex((a) => a.id === action.id);
    const current = list[idx];
    if (idx >= 0 && current) {
      list[idx] = {
        ...current,
        lastAttemptAt: now,
        deliveryFailCount: (current.deliveryFailCount ?? 0) + 1,
      };
      await savePendingActions(list);
      dispatchPendingActionsChanged();
    }
    return false;
  }
  const local = await loadOwnDeviceMeta();
  const pendingToSend = {
    ...action.pending,
    proposerDeviceId: local.id,
    proposerDeviceName: local.name,
  };
  const ok = await pushSyncContractToLanPeers(deviceRows, pendingToSend);
  const now = Date.now();
  const list = await loadPendingActions();
  const idx = list.findIndex((a) => a.id === action.id);
  const current = list[idx];
  if (idx < 0 || !current) return ok;
  const updated: SyncPendingAction = ok
    ? { ...current, lastAttemptAt: now, deliveredAt: now }
    : {
        ...current,
        lastAttemptAt: now,
        deliveryFailCount: (current.deliveryFailCount ?? 0) + 1,
      };
  list[idx] = updated;
  await savePendingActions(list);
  dispatchPendingActionsChanged();
  // Exchange is NOT attempted here — the peer hasn't accepted the contract yet.
  // The first exchange runs after the peer sends an explicit accept.
  return ok;
}

export async function runPendingActionNow(
  actionId: string,
  devices: ConnectedDevice[],
): Promise<boolean> {
  const list = await loadPendingActions();
  const action = list.find((a) => a.id === actionId);
  if (!action) return false;
  return tryDeliverAction(action, devices);
}

export async function cancelPendingAction(actionId: string): Promise<SyncContractSnapshot | null> {
  const list = await loadPendingActions();
  const action = list.find((a) => a.id === actionId);
  if (!action) return null;
  const baseline = action.preAcceptBaseline;
  await savePendingActions(list.filter((a) => a.id !== actionId));
  if (action.kind === 'send_contract') {
    await savePendingOutgoingContract(null);
  }
  dispatchPendingActionsChanged();
  return baseline;
}

let schedulerTimer: ReturnType<typeof setInterval> | null = null;

export function startPendingActionsScheduler(
  loadDevices: () => Promise<ConnectedDevice[]>,
): void {
  if (schedulerTimer) return;
  schedulerTimer = setInterval(() => {
    void (async () => {
      const list = await loadPendingActions();
      const devices = await loadDevices();
      const now = Date.now();
      for (const action of list) {
        if (action.kind !== 'send_contract') continue;
        if (action.deliveredAt) continue;
        const last = action.lastAttemptAt ?? 0;
        if (now - last < action.intervalSeconds * 1000) continue;
        await tryDeliverAction(action, devices);
      }
    })();
  }, 5000);
}

export function stopPendingActionsScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}
