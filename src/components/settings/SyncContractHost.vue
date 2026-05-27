<template>
  <SyncContractPreviewDialog
    v-model="showIncomingPreview"
    incoming
    :duplicate-resolution="incomingDuplicateResolution"
    :preview="incomingPreview"
    :interval-seconds="incomingIntervalSeconds"
    :min-sync-interval="minSyncInterval"
    :max-sync-interval="maxSyncInterval"
    @confirm="onIncomingPreviewAccept"
    @reject="onIncomingPreviewReject"
    @cancel="showIncomingPreview = false"
  />
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { $text } from 'src/modules/lang';
import { Notify } from 'quasar';
import {
  buildIncomingContractPreview,
  dispatchSyncContractIncoming,
  loadIncomingBannerState,
  OPEN_INCOMING_SYNC_REVIEW_EVENT,
  resolveProposerLanHost,
  SYNC_CONTRACT_INCOMING_EVENT,
  SYNC_CONTRACT_REJECTED_EVENT,
} from 'src/modules/storage/sync/syncContractIncoming';
import {
  loadConnectedDevices,
  loadOwnDeviceMeta,
  mergeLocalDeviceIntoList,
  normalizeDeviceId,
  saveConnectedDevices,
} from 'src/modules/storage/sync/deviceRoleAssignment';
import { refreshLanServerForConnections } from 'src/modules/lan/lanServerManager';
import { getCo21LanApi } from 'src/modules/lan/co21LanRuntime';
import { rememberPeerLanHost } from 'src/modules/lan/lanRemoteHost';
import { co21LanBaseUrl } from 'src/modules/lan/lanPairingConstants';
import { lanPostSyncContractReject, lanPostSyncContractAccept } from 'src/modules/lan/lanSyncContract';
import type { SyncContractAcceptPayload } from 'src/modules/lan/lanSyncContract';
import { loadCo21Settings } from 'src/modules/storage/sync/roleProfileSettings';
import logger from 'src/utils/logger';
import type { SyncContractPending } from 'src/modules/storage/sync/syncContractSettings';
import {
  loadPendingIncomingContract,
  saveLastContractSnapshot,
  savePendingIncomingContract,
  savePendingOutgoingContract,
  DEFAULT_SYNC_INTERVAL_SECONDS,
  DEFAULT_SYNC_DUPLICATE_RESOLUTION,
  MIN_SYNC_INTERVAL_SECONDS,
  MAX_SYNC_INTERVAL_SECONDS,
  loadSyncIntervalSeconds,
  normalizeSyncDuplicateResolution,
  saveSyncDuplicateResolution,
  type SyncDuplicateResolution,
} from 'src/modules/storage/sync/syncContractSettings';
import type { SyncContractPreview } from 'src/modules/storage/sync/syncContractPreview';
import {
  cancelPendingAction,
  dispatchPendingActionsChanged,
  findSendContractAction,
} from 'src/modules/storage/sync/syncPendingActions';
import { ensurePeerSyncSession } from 'src/modules/storage/sync/syncPeerState';
import type { LanSyncExchangeRequest } from 'src/modules/lan/lanSyncAuth';
import {
  handleLanSyncExchangeRequest,
  runFirstSyncAfterContractAccept,
} from 'src/modules/storage/sync/lanOrganiserSync';
import { setSyncContractRuntime } from 'src/modules/storage/sync/syncContractRuntime';
import { loadActiveContractForSync } from 'src/modules/storage/sync/syncContractSettings';
import { applyContractSnapshotGroupsToOrganiser } from 'src/modules/storage/sync/syncContractGroups';
import { applyContractSnapshotToLocalRegistry } from 'src/modules/storage/sync/syncContractApply';
import SyncContractPreviewDialog from './SyncContractPreviewDialog.vue';

const showIncomingPreview = ref(false);
const incomingPreview = ref<SyncContractPreview | null>(null);
const incomingIntervalSeconds = ref(DEFAULT_SYNC_INTERVAL_SECONDS);
const incomingDuplicateResolution = ref<SyncDuplicateResolution>(DEFAULT_SYNC_DUPLICATE_RESOLUTION);
let pendingIncomingContract: SyncContractPending | null = null;

const minSyncInterval = MIN_SYNC_INTERVAL_SECONDS;
const maxSyncInterval = MAX_SYNC_INTERVAL_SECONDS;

function pendingFromLanDetail(raw: Record<string, unknown>): SyncContractPending | null {
  const snapshot = raw.snapshot;
  const proposerDeviceId =
    typeof raw.proposerDeviceId === 'string' ? raw.proposerDeviceId.trim() : '';
  if (!snapshot || typeof snapshot !== 'object' || !proposerDeviceId) return null;
  const pending: SyncContractPending = {
    createdAt: typeof raw.createdAt === 'number' && raw.createdAt > 0 ? raw.createdAt : Date.now(),
    snapshot: snapshot as SyncContractPending['snapshot'],
    proposerDeviceId,
    proposerDeviceName:
      typeof raw.proposerDeviceName === 'string' && raw.proposerDeviceName.trim()
        ? raw.proposerDeviceName.trim()
        : 'Unknown device',
  };
  if (typeof raw.proposerLanHost === 'string' && raw.proposerLanHost.trim()) {
    pending.proposerLanHost = raw.proposerLanHost.trim();
  }
  if (typeof raw.intervalSeconds === 'number' && raw.intervalSeconds > 0) {
    pending.intervalSeconds = Math.floor(raw.intervalSeconds);
  }
  if (raw.duplicateResolution === 'manual' || raw.duplicateResolution === 'auto') {
    pending.duplicateResolution = raw.duplicateResolution;
  }
  if (typeof raw.syncSessionToken === 'string' && raw.syncSessionToken.trim()) {
    pending.syncSessionToken = raw.syncSessionToken.trim();
  }
  return pending;
}

/** Ensure proposer appears in Connections (server already accepted the POST). */
async function ensureProposerInConnections(pending: SyncContractPending): Promise<void> {
  const local = await loadOwnDeviceMeta();
  const loaded = await loadConnectedDevices();
  let devices = mergeLocalDeviceIntoList(loaded, local);
  const norm = normalizeDeviceId(pending.proposerDeviceId);
  const lanHost = (pending.proposerLanHost || '').trim();
  const idx = devices.findIndex((d) => !d.isLocal && normalizeDeviceId(d.id) === norm);
  const existing = idx >= 0 ? devices[idx] : undefined;
  if (existing) {
    if (lanHost && !(existing.lanHost || '').trim()) {
      devices = devices.map((d, i) => (i === idx ? { ...d, lanHost } : d));
      await saveConnectedDevices(devices);
      const settings = await loadCo21Settings();
      const ownName =
        typeof settings.ownDeviceName === 'string' ? settings.ownDeviceName : local.name;
      await refreshLanServerForConnections(devices, ownName);
    }
    return;
  }
  const snapRow = pending.snapshot.devices.find((x) => normalizeDeviceId(x.id) === norm);
  devices = [
    ...devices,
    {
      id: pending.proposerDeviceId,
      name: pending.proposerDeviceName || snapRow?.name || 'LAN device',
      type: 'LAN',
      ...(lanHost ? { lanHost } : {}),
    },
  ];
  await saveConnectedDevices(devices);
  if (lanHost) await rememberPeerLanHost(pending.proposerDeviceId, lanHost);
  const settings = await loadCo21Settings();
  const ownName =
    typeof settings.ownDeviceName === 'string' ? settings.ownDeviceName : local.name;
  await refreshLanServerForConnections(devices, ownName);
}

async function persistIncomingFromLan(raw: unknown): Promise<void> {
  if (!raw || typeof raw !== 'object') return;
  const pending = pendingFromLanDetail(raw as Record<string, unknown>);
  if (!pending) {
    logger.warn('[SyncContractHost] invalid incoming contract payload', raw);
    return;
  }
  await ensureProposerInConnections(pending);
  if (pending.syncSessionToken) {
    await ensurePeerSyncSession(
      pending.proposerDeviceId,
      pending.proposerDeviceName,
      pending.syncSessionToken,
    );
  }
  await savePendingIncomingContract(pending);
  await refreshIncomingBanner();
  dispatchSyncContractIncoming();
}

async function refreshIncomingBanner(): Promise<void> {
  const state = await loadIncomingBannerState();
  pendingIncomingContract = state.pending;
}

async function openIncomingReview(): Promise<void> {
  if (!pendingIncomingContract) {
    const incoming = await loadPendingIncomingContract();
    if (!incoming) return;
    pendingIncomingContract = incoming;
  }
  incomingPreview.value = await buildIncomingContractPreview(pendingIncomingContract);
  incomingIntervalSeconds.value =
    pendingIncomingContract.intervalSeconds ?? (await loadSyncIntervalSeconds());
  incomingDuplicateResolution.value = normalizeSyncDuplicateResolution(
    pendingIncomingContract.duplicateResolution ??
      pendingIncomingContract.snapshot.duplicateResolution,
  );
  showIncomingPreview.value = true;
}

async function clearIncomingState(): Promise<void> {
  await savePendingIncomingContract(null);
  showIncomingPreview.value = false;
  pendingIncomingContract = null;
  incomingPreview.value = null;
  dispatchSyncContractIncoming();
}

async function sendAcceptToProposer(
  pending: SyncContractPending,
): Promise<boolean> {
  const local = await loadOwnDeviceMeta();
  const host = await resolveProposerLanHost(pending);
  const base = host ? co21LanBaseUrl(host) : '';
  if (!base) return false;
  const payload: SyncContractAcceptPayload = {
    acceptorDeviceId: local.id,
    acceptorDeviceName: local.name,
    proposerDeviceId: pending.proposerDeviceId,
    createdAt: pending.createdAt,
  };
  return lanPostSyncContractAccept(base, payload);
}

let pendingAcceptRetry: SyncContractPending | null = null;

async function retryPendingAcceptIfNeeded(): Promise<void> {
  if (!pendingAcceptRetry) return;
  const pending = pendingAcceptRetry;
  const ok = await sendAcceptToProposer(pending);
  if (ok) {
    pendingAcceptRetry = null;
    logger.info('[SyncContractHost] accept retry succeeded');
  }
}

async function onIncomingPreviewAccept(): Promise<void> {
  if (!pendingIncomingContract?.snapshot) return;
  const token = pendingIncomingContract.syncSessionToken;
  const pending = pendingIncomingContract;
  await saveSyncDuplicateResolution(incomingDuplicateResolution.value);
  const savedSnapshot = {
    ...pending.snapshot,
    duplicateResolution: incomingDuplicateResolution.value,
  };
  await applyContractSnapshotGroupsToOrganiser(savedSnapshot);
  await applyContractSnapshotToLocalRegistry(savedSnapshot);
  await saveLastContractSnapshot(savedSnapshot);
  setSyncContractRuntime(savedSnapshot);
  await ensurePeerSyncSession(
    pending.proposerDeviceId,
    pending.proposerDeviceName,
    token,
  );
  await savePendingOutgoingContract(null);
  await savePendingIncomingContract(null);
  showIncomingPreview.value = false;
  pendingIncomingContract = null;
  incomingPreview.value = null;
  dispatchSyncContractIncoming();
  Notify.create({
    type: 'positive',
    message: $text('sync.contract_signed_ok'),
    timeout: 2500,
  });
  window.dispatchEvent(new Event('co21:sync-contract-signed'));

  const accepted = await sendAcceptToProposer(pending);
  if (!accepted) {
    pendingAcceptRetry = pending;
    logger.warn('[SyncContractHost] accept delivery failed — will retry on next peer discovery');
  } else {
    pendingAcceptRetry = null;
  }
  void runFirstSyncAfterContractAccept(token);
}

async function onIncomingPreviewReject(): Promise<void> {
  if (!pendingIncomingContract) return;
  const local = await loadOwnDeviceMeta();
  const host = await resolveProposerLanHost(pendingIncomingContract);
  const base = host ? co21LanBaseUrl(host) : '';
  if (base) {
    const ok = await lanPostSyncContractReject(base, {
      rejectorDeviceId: local.id,
      rejectorDeviceName: local.name,
      proposerDeviceId: pendingIncomingContract.proposerDeviceId,
      createdAt: pendingIncomingContract.createdAt,
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
        pendingIncomingContract.proposerDeviceName || '?',
      ),
      timeout: 3500,
    });
  }
  await clearIncomingState();
  Notify.create({
    type: 'info',
    message: $text('sync.contract_rejected_local'),
    timeout: 2500,
  });
}

async function handlePeerRejectedContract(detail: unknown): Promise<void> {
  if (!detail || typeof detail !== 'object') return;
  const name =
    typeof (detail as { rejectorDeviceName?: string }).rejectorDeviceName === 'string'
      ? (detail as { rejectorDeviceName: string }).rejectorDeviceName.trim()
      : '';
  const action = await findSendContractAction();
  if (action) {
    await cancelPendingAction(action.id);
    dispatchPendingActionsChanged();
  }
  await savePendingOutgoingContract(null);
  Notify.create({
    type: 'warning',
    message: $text('sync.contract_rejected_by_peer').replace('{device}', name || '?'),
    timeout: 4000,
  });
  window.dispatchEvent(new Event(SYNC_CONTRACT_REJECTED_EVENT));
}

async function handlePeerAcceptedContract(detail: unknown): Promise<void> {
  if (!detail || typeof detail !== 'object') return;
  const d = detail as Record<string, unknown>;
  const acceptorName =
    typeof d.acceptorDeviceName === 'string' ? d.acceptorDeviceName.trim() : '';
  logger.info('[SyncContractHost] peer accepted contract', acceptorName);
  const { finalizeAcceptedOutgoingContract } = await import(
    'src/modules/storage/sync/syncPendingActions'
  );
  const { promoted, sessionToken } = await finalizeAcceptedOutgoingContract();
  if (promoted) {
    Notify.create({
      type: 'positive',
      message: $text('sync.contract_signed_ok'),
      timeout: 2500,
    });
  }
  void runFirstSyncAfterContractAccept(sessionToken);
}

let acceptRetryTimer: ReturnType<typeof setInterval> | null = null;

let lanIncomingUnsub: (() => void) | undefined;
let lanRejectedUnsub: (() => void) | undefined;
let lanAcceptedUnsub: (() => void) | undefined;

const onIncomingEvent = () => {
  void refreshIncomingBanner();
};

const onOpenReviewEvent = () => {
  void openIncomingReview();
};

onMounted(() => {
  (globalThis as typeof globalThis & {
    __co21LanSyncExchange?: (req: LanSyncExchangeRequest) => Promise<unknown>;
  }).__co21LanSyncExchange = (req) => handleLanSyncExchangeRequest(req);

  void (async () => {
    const active = await loadActiveContractForSync();
    if (active) setSyncContractRuntime(active);
  })();
  void refreshIncomingBanner();

  window.addEventListener(SYNC_CONTRACT_INCOMING_EVENT, onIncomingEvent);
  window.addEventListener('co21:sync-contract-signed', onIncomingEvent);
  window.addEventListener(OPEN_INCOMING_SYNC_REVIEW_EVENT, onOpenReviewEvent);

  const lan = getCo21LanApi();
  if (lan?.onSyncContractIncoming) {
    lanIncomingUnsub = lan.onSyncContractIncoming((detail) => {
      void persistIncomingFromLan(detail);
    });
  }
  if (lan?.onSyncContractRejected) {
    lanRejectedUnsub = lan.onSyncContractRejected((detail) => {
      void handlePeerRejectedContract(detail);
    });
  }
  if (lan?.onSyncContractAccepted) {
    lanAcceptedUnsub = lan.onSyncContractAccepted((detail) => {
      void handlePeerAcceptedContract(detail);
    });
  }
  acceptRetryTimer = setInterval(() => void retryPendingAcceptIfNeeded(), 15_000);
});

onBeforeUnmount(() => {
  delete (globalThis as { __co21LanSyncExchange?: unknown }).__co21LanSyncExchange;

  window.removeEventListener(SYNC_CONTRACT_INCOMING_EVENT, onIncomingEvent);
  window.removeEventListener('co21:sync-contract-signed', onIncomingEvent);
  window.removeEventListener(OPEN_INCOMING_SYNC_REVIEW_EVENT, onOpenReviewEvent);
  lanIncomingUnsub?.();
  lanRejectedUnsub?.();
  lanAcceptedUnsub?.();
  if (acceptRetryTimer) {
    clearInterval(acceptRetryTimer);
    acceptRetryTimer = null;
  }
});

defineExpose({ refreshIncomingBanner });
</script>
