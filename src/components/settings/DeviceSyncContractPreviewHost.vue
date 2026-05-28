<template>
  <SyncContractPreviewDialog
    v-model="dialogVisible"
    :preview="preview"
    :incoming="incomingMode"
    :preview-only="previewOnly"
    v-model:interval-seconds="intervalSeconds"
    v-model:duplicate-resolution="duplicateResolution"
    :min-sync-interval="minSyncInterval"
    :max-sync-interval="maxSyncInterval"
    @confirm="onConfirm"
    @reject="onReject"
    @cancel="dialogVisible = false"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import SyncContractPreviewDialog from './SyncContractPreviewDialog.vue';
import {
  buildMergedPairPreview,
  type MergedDevicePairContract,
} from 'src/modules/storage/sync/syncDeviceContracts';
import {
  DEFAULT_SYNC_DUPLICATE_RESOLUTION,
  MIN_SYNC_INTERVAL_SECONDS,
  MAX_SYNC_INTERVAL_SECONDS,
  normalizeSyncDuplicateResolution,
  type SyncDuplicateResolution,
} from 'src/modules/storage/sync/syncContractSettings';
import type { SyncContractPreview } from 'src/modules/storage/sync/syncContractPreview';
import type { ConnectedDevice } from 'src/modules/storage/sync/deviceRoleAssignment';
import {
  acceptPendingIncomingContract,
  rejectPendingIncomingContract,
} from 'src/modules/storage/sync/syncContractAccept';

const props = defineProps<{
  modelValue: boolean;
  device: ConnectedDevice | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'accepted'): void;
  (e: 'rejected'): void;
  (e: 'remove', device: ConnectedDevice): void;
  (e: 'resend', device: ConnectedDevice): void;
}>();

const preview = ref<SyncContractPreview | null>(null);
const mergedState = ref<MergedDevicePairContract | null>(null);
const intervalSeconds = ref(60);
const duplicateResolution = ref<SyncDuplicateResolution>(DEFAULT_SYNC_DUPLICATE_RESOLUTION);

const minSyncInterval = MIN_SYNC_INTERVAL_SECONDS;
const maxSyncInterval = MAX_SYNC_INTERVAL_SECONDS;

const dialogVisible = computed({
  get: () => !!props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

const incomingMode = computed(() => !!mergedState.value?.needsConfirm);
const previewOnly = computed(() => !incomingMode.value);

watch(
  () => [props.modelValue, props.device?.id] as const,
  ([open]) => {
    if (open && props.device) void loadPreview(props.device);
  },
);

async function loadPreview(device: ConnectedDevice): Promise<void> {
  const built = await buildMergedPairPreview(device.id);
  mergedState.value = built.merged;
  preview.value = built.preview;
  intervalSeconds.value = built.merged.intervalSeconds;
  duplicateResolution.value = normalizeSyncDuplicateResolution(
    built.merged.duplicateResolution,
  );
}

async function onConfirm(): Promise<void> {
  if (!props.device || !mergedState.value?.incomingPending) return;
  const result = await acceptPendingIncomingContract({
    duplicateResolution: duplicateResolution.value,
    intervalSeconds: intervalSeconds.value,
  });
  if (result.ok) {
    emit('accepted');
    dialogVisible.value = false;
  }
}

async function onReject(): Promise<void> {
  await rejectPendingIncomingContract();
  emit('rejected');
  dialogVisible.value = false;
}

defineExpose({ reload: () => props.device && loadPreview(props.device) });
</script>
