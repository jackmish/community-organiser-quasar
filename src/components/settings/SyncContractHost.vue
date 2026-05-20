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
  loadIncomingBannerState,
  SYNC_CONTRACT_INCOMING_EVENT,
} from 'src/modules/storage/sync/syncContractIncoming';
import {
  loadConnectedDevices,
  loadOwnDeviceMeta,
  mergeLocalDeviceIntoList,
  normalizeDeviceId,
} from 'src/modules/storage/sync/deviceRoleAssignment';
import { registeredRemoteDeviceIds } from 'src/modules/lan/lanServerManager';
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

function isValidIncomingPending(raw: unknown): raw is SyncContractPending {
  if (!raw || typeof raw !== 'object') return false;
  const p = raw as SyncContractPending;
  return (
    typeof p.createdAt === 'number' &&
    typeof p.proposerDeviceId === 'string' &&
    p.proposerDeviceId.length > 0 &&
    !!p.snapshot &&
    typeof p.snapshot === 'object'
  );
}

async function isProposerRegistered(proposerDeviceId: string): Promise<boolean> {
  const local = await loadOwnDeviceMeta();
  const loaded = await loadConnectedDevices();
  const devices = mergeLocalDeviceIntoList(loaded, local);
  const ids = registeredRemoteDeviceIds(devices);
  if (!ids.length) return true;
  const proposerNorm = normalizeDeviceId(proposerDeviceId);
  return ids.some((id) => normalizeDeviceId(id) === proposerNorm);
}

async function persistIncomingFromLan(raw: unknown): Promise<void> {
  if (!isValidIncomingPending(raw)) return;
  if (!(await isProposerRegistered(raw.proposerDeviceId))) {
    logger.warn(
      '[SyncContractHost] ignored contract from unregistered device',
      raw.proposerDeviceId,
    );
    return;
  }
  await savePendingIncomingContract(raw);
  await refreshIncomingBanner();
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

onMounted(() => {
  void refreshIncomingBanner();

  window.addEventListener(SYNC_CONTRACT_INCOMING_EVENT, onIncomingEvent);
  window.addEventListener('co21:sync-contract-signed', onIncomingEvent);

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
  lanUnsub?.();
});

defineExpose({ refreshIncomingBanner });
</script>
