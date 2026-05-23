import { isPresentationModeActive } from 'src/composables/usePresentationGuard';
import {
  LAN_INFO_PROBE_MS,
  listLanPeersConfirmedByInfo,
  listRemoteLanDevices,
  probeAllLanPeers,
  probeLanPeerInfo,
} from 'src/modules/lan/lanPeerConnectivity';
import { reconcileLanDeviceIds } from 'src/modules/lan/lanDeviceReconcile';
import { prepareRemotesForLanOps } from 'src/modules/lan/lanRemoteHost';
import { ensureLanServerForSync, syncLanTrustedContractDevices } from 'src/modules/lan/lanServerManager';
import { loadCo21Settings } from './roleProfileSettings';
import { loadActiveContractForSync } from './syncContractSettings';
import {
  loadConnectedDevices,
  loadOwnDeviceMeta,
  mergeLocalDeviceIntoList,
  saveConnectedDevices,
} from './deviceRoleAssignment';
import { findSyncPeerState, loadSyncPeerStates } from './syncPeerState';
import { runSyncWithPeer } from './lanOrganiserSync';

/** Debounce rapid edits (preview priority, line edits) into one exchange per peer. */
const DEBOUNCE_MS = 600;

/** Background / on-change sync exchange timeout (only after /info succeeded). */
const SYNC_EXCHANGE_MS = 8_000;

/** How often to retry /info for peers currently marked offline. */
const RECONNECT_INTERVAL_MS = 45_000;

let suppressCount = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let syncRunning = false;
let runAgainAfterCurrent = false;
let reconnectTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTickRunning = false;

export function suppressOrganiserSyncTrigger(): void {
  suppressCount += 1;
}

export function releaseOrganiserSyncTrigger(): void {
  suppressCount = Math.max(0, suppressCount - 1);
}

export async function withOrganiserSyncTriggerSuppressed<T>(fn: () => Promise<T>): Promise<T> {
  suppressOrganiserSyncTrigger();
  try {
    return await fn();
  } finally {
    releaseOrganiserSyncTrigger();
  }
}

/** Queue sync for peers confirmed via /info (after local data changed). */
export function scheduleLanSyncAfterOrganiserChange(): void {
  if (suppressCount > 0) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void runLanSyncForAllPeers();
  }, DEBOUNCE_MS);
}

/** GET /info + device-id reconcile (background only — never blocks UI). */
async function runLanStartupProbeAndReconcile(): Promise<void> {
  if (isPresentationModeActive()) return;
  if (!(await loadActiveContractForSync())) return;

  const local = await loadOwnDeviceMeta();
  const settings = await loadCo21Settings();
  const ownName =
    typeof settings.ownDeviceName === 'string' ? settings.ownDeviceName.trim() : local.name;
  await ensureLanServerForSync(ownName || local.name);

  await prepareRemotesForLanOps({ persistHosts: true });

  const probes = await probeAllLanPeers(LAN_INFO_PROBE_MS);
  try {
    const local2 = await loadOwnDeviceMeta();
    const devices = mergeLocalDeviceIntoList(await loadConnectedDevices(), local2);
    const { devices: reconciled, repaired } = await reconcileLanDeviceIds(devices, {
      probeResults: probes,
    });
    if (repaired.length) {
      await saveConnectedDevices(reconciled);
      await syncLanTrustedContractDevices(reconciled);
    }
  } catch {
    void 0;
  }
}

/**
 * After organiser is visible: probe peers in background, then sync those that answered /info.
 * Does not block the loading overlay.
 */
export function scheduleBackgroundLanSyncAfterDisplay(): void {
  if (isPresentationModeActive()) return;
  void withOrganiserSyncTriggerSuppressed(async () => {
    await runLanStartupProbeAndReconcile();
    await runLanSyncForConfirmedPeers();
  });
}

export async function runLanSyncForAllPeersNow(): Promise<void> {
  await runLanSyncForAllPeers();
}

export function startLanPeerReconnectScheduler(): void {
  if (reconnectTimer) return;
  reconnectTimer = setInterval(() => {
    void tickLanPeerReconnect();
  }, RECONNECT_INTERVAL_MS);
}

export function stopLanPeerReconnectScheduler(): void {
  if (reconnectTimer) {
    clearInterval(reconnectTimer);
    reconnectTimer = null;
  }
}

/** Periodically /info offline peers; sync when a peer comes back. */
async function tickLanPeerReconnect(): Promise<void> {
  if (reconnectTickRunning || syncRunning || suppressCount > 0) return;
  if (isPresentationModeActive()) return;
  if (!(await loadActiveContractForSync())) return;

  reconnectTickRunning = true;
  try {
    const remotes = await prepareRemotesForLanOps({ persistHosts: false });
    if (!remotes.length) return;

    const states = await loadSyncPeerStates();
    const offline = remotes.filter((d) => {
      const s = states.find((p) => p.peerDeviceId === d.id);
      return s?.peerInRange !== true;
    });
    if (!offline.length) return;

    for (const d of offline) {
      const probe = await probeLanPeerInfo(d, LAN_INFO_PROBE_MS);
      if (!probe.ok) continue;
      await withOrganiserSyncTriggerSuppressed(async () => {
        await runSyncWithPeer({
          peerDeviceId: d.id,
          peerDeviceName: d.name,
          lanHost: (d.lanHost || '').trim(),
          exchangeTimeoutMs: SYNC_EXCHANGE_MS,
          skipInfoProbe: true,
        });
      });
    }
  } finally {
    reconnectTickRunning = false;
  }
}

/** Sync exchange only for peers with peerInRange === true (no extra /info). */
async function runLanSyncForConfirmedPeers(opts?: { exchangeTimeoutMs?: number }): Promise<void> {
  if (syncRunning) {
    runAgainAfterCurrent = true;
    return;
  }
  syncRunning = true;
  try {
    if (!(await loadActiveContractForSync())) return;
    const remotes = await listLanPeersConfirmedByInfo();
    if (!remotes.length) return;
    const exchangeTimeoutMs = opts?.exchangeTimeoutMs ?? SYNC_EXCHANGE_MS;
    for (const d of remotes) {
      await runSyncWithPeer({
        peerDeviceId: d.id,
        peerDeviceName: d.name,
        lanHost: (d.lanHost || '').trim(),
        exchangeTimeoutMs,
        skipInfoProbe: true,
      });
    }
  } finally {
    syncRunning = false;
    if (runAgainAfterCurrent) {
      runAgainAfterCurrent = false;
      scheduleLanSyncAfterOrganiserChange();
    }
  }
}

/**
 * For each remote: GET /info first; run sync exchange only when /info succeeds.
 */
async function runLanSyncForAllPeers(opts?: { exchangeTimeoutMs?: number }): Promise<void> {
  if (syncRunning) {
    runAgainAfterCurrent = true;
    return;
  }
  syncRunning = true;
  try {
    if (!(await loadActiveContractForSync())) return;

    const remotes = await prepareRemotesForLanOps({ persistHosts: true });
    if (!remotes.length) return;

    const exchangeTimeoutMs = opts?.exchangeTimeoutMs ?? SYNC_EXCHANGE_MS;

    const now = Date.now();
    const freshProbeMs = 8_000;

    for (const d of remotes) {
      const state = await findSyncPeerState(d.id);
      const recentlyProbed =
        typeof state?.peerCheckedAt === 'number' &&
        now - state.peerCheckedAt < freshProbeMs;

      if (!recentlyProbed) {
        const probe = await probeLanPeerInfo(d, LAN_INFO_PROBE_MS);
        if (!probe.ok) continue;
      } else if (state?.peerInRange !== true) {
        continue;
      }

      await runSyncWithPeer({
        peerDeviceId: d.id,
        peerDeviceName: d.name,
        lanHost: (d.lanHost || '').trim(),
        exchangeTimeoutMs,
        skipInfoProbe: true,
      });
    }
  } finally {
    syncRunning = false;
    if (runAgainAfterCurrent) {
      runAgainAfterCurrent = false;
      scheduleLanSyncAfterOrganiserChange();
    }
  }
}
