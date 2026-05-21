<template>
  <Teleport to="#co21-sync-contract-slot">
    <SyncContractIncomingNotification
      :show="showIncomingBanner"
      :proposer-name="incomingProposerName"
      @review="openIncomingReview"
    />
  </Teleport>

  <SyncContractPreviewDialog
    v-model="showIncomingPreview"
    v-model:interval-seconds="incomingIntervalSeconds"
    :duplicate-resolution="incomingDuplicateResolution"
    @update:duplicate-resolution="onIncomingDuplicateChange"
    :preview="incomingPreview"
    :min-sync-interval="minSyncInterval"
    :max-sync-interval="maxSyncInterval"
    @confirm="onIncomingPreviewAccept"
    @cancel="showIncomingPreview = false"
  />
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { Notify } from 'quasar';
import { $text } from 'src/modules/lang';
import {
  buildIncomingContractPreview,
  dispatchSyncContractIncoming,
  loadIncomingBannerState,
  OPEN_INCOMING_SYNC_REVIEW_EVENT,
  SYNC_CONTRACT_INCOMING_EVENT,
} from 'src/modules/storage/sync/syncContractIncoming';
import {
  loadConnectedDevices,
  loadOwnDeviceMeta,
  mergeLocalDeviceIntoList,
  normalizeDeviceId,
  saveConnectedDevices,
} from 'src/modules/storage/sync/deviceRoleAssignment';
import { refreshLanServerForConnections } from 'src/modules/lan/lanServerManager';
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
import SyncContractIncomingNotification from './SyncContractIncomingNotification.vue';
import SyncContractPreviewDialog from './SyncContractPreviewDialog.vue';

const showIncomingBanner = ref(false);
const incomingProposerName = ref('');
const showIncomingPreview = ref(false);
const incomingPreview = ref<SyncContractPreview | null>(null);
const incomingIntervalSeconds = ref(DEFAULT_SYNC_INTERVAL_SECONDS);
const incomingDuplicateResolution = ref<SyncDuplicateResolution>(DEFAULT_SYNC_DUPLICATE_RESOLUTION);
let pendingIncomingContract: SyncContractPending | null = null;

function onIncomingDuplicateChange(mode: SyncDuplicateResolution): void {
  incomingDuplicateResolution.value = mode;
  if (pendingIncomingContract?.snapshot) {
    pendingIncomingContract = {
      ...pendingIncomingContract,
      snapshot: { ...pendingIncomingContract.snapshot, duplicateResolution: mode },
    };
  }
}

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
  if (typeof raw.intervalSeconds === 'number' && raw.intervalSeconds > 0) {
    pending.intervalSeconds = Math.floor(raw.intervalSeconds);
  }
  if (raw.duplicateResolution === 'manual' || raw.duplicateResolution === 'auto') {
    pending.duplicateResolution = raw.duplicateResolution;
  }
  return pending;
}

/** Ensure proposer appears in Connections (server already accepted the POST). */
async function ensureProposerInConnections(pending: SyncContractPending): Promise<void> {
  const local = await loadOwnDeviceMeta();
  const loaded = await loadConnectedDevices();
  let devices = mergeLocalDeviceIntoList(loaded, local);
  const norm = normalizeDeviceId(pending.proposerDeviceId);
  if (devices.some((d) => !d.isLocal && normalizeDeviceId(d.id) === norm)) {
    return;
  }
  const snapRow = pending.snapshot.devices.find((x) => normalizeDeviceId(x.id) === norm);
  devices = [
    ...devices,
    {
      id: pending.proposerDeviceId,
      name: pending.proposerDeviceName || snapRow?.name || 'LAN device',
      type: 'LAN',
    },
  ];
  await saveConnectedDevices(devices);
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
  await savePendingIncomingContract(pending);
  await refreshIncomingBanner();
  dispatchSyncContractIncoming();
  const name = pending.proposerDeviceName || '?';
  Notify.create({
    type: 'info',
    message: $text('sync.incoming_banner').replace('{device}', name),
    timeout: 0,
    actions: [
      {
        label: $text('sync.incoming_review_btn'),
        color: 'white',
        handler: () => {
          void openIncomingReview();
        },
      },
    ],
  });
}

async function refreshIncomingBanner(): Promise<void> {
  const state = await loadIncomingBannerState();
  showIncomingBanner.value = state.showBanner;
  incomingProposerName.value = state.pending?.proposerDeviceName ?? '';
  pendingIncomingContract = state.pending;
}

async function openIncomingReview(): Promise<void> {
  if (!pendingIncomingContract) {
    const incoming = await loadPendingIncomingContract();
    if (!incoming) return;
    pendingIncomingContract = incoming;
  }
  incomingPreview.value = await buildIncomingContractPreview(pendingIncomingContract);
  const interval = await loadSyncIntervalSeconds();
  incomingIntervalSeconds.value = interval;
  incomingDuplicateResolution.value = normalizeSyncDuplicateResolution(
    pendingIncomingContract.snapshot.duplicateResolution,
  );
  showIncomingPreview.value = true;
}

async function onIncomingPreviewAccept(): Promise<void> {
  if (!pendingIncomingContract?.snapshot) return;
  await saveSyncDuplicateResolution(incomingDuplicateResolution.value);
  await saveLastContractSnapshot({
    ...pendingIncomingContract.snapshot,
    duplicateResolution: incomingDuplicateResolution.value,
  });
  await savePendingOutgoingContract(null);
  await savePendingIncomingContract(null);
  Notify.create({
    type: 'positive',
    message: $text('sync.contract_signed_ok'),
    timeout: 2500,
  });
  window.dispatchEvent(new Event('co21:sync-contract-signed'));
  showIncomingPreview.value = false;
  showIncomingBanner.value = false;
  pendingIncomingContract = null;
  incomingPreview.value = null;
}

let lanUnsub: (() => void) | undefined;

const onIncomingEvent = () => {
  void refreshIncomingBanner();
};

const onOpenReviewEvent = () => {
  void openIncomingReview();
};

onMounted(() => {
  void refreshIncomingBanner();

  window.addEventListener(SYNC_CONTRACT_INCOMING_EVENT, onIncomingEvent);
  window.addEventListener('co21:sync-contract-signed', onIncomingEvent);
  window.addEventListener(OPEN_INCOMING_SYNC_REVIEW_EVENT, onOpenReviewEvent);

  const lan = (
    window as Window & {
      electronLan?: { onSyncContractIncoming?: (cb: (d: unknown) => void) => () => void };
    }
  ).electronLan;
  if (lan?.onSyncContractIncoming) {
    lanUnsub = lan.onSyncContractIncoming((detail) => {
      void persistIncomingFromLan(detail);
    });
  }
});

onBeforeUnmount(() => {
  window.removeEventListener(SYNC_CONTRACT_INCOMING_EVENT, onIncomingEvent);
  window.removeEventListener('co21:sync-contract-signed', onIncomingEvent);
  window.removeEventListener(OPEN_INCOMING_SYNC_REVIEW_EVENT, onOpenReviewEvent);
  lanUnsub?.();
});

defineExpose({ refreshIncomingBanner });
</script>
