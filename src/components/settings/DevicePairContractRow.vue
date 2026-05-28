<template>
  <div v-if="!device.isLocal" class="device-pair-contract row items-center q-gutter-xs q-mt-sm flex-wrap">
    <q-spinner v-if="loading" size="16px" color="primary" />
    <template v-else-if="merged">
      <q-chip
        v-if="merged.phase !== 'none'"
        dense
        size="sm"
        :color="merged.statusColor"
        text-color="white"
      >
        {{ merged.statusLabel }}
      </q-chip>
      <span v-else class="text-caption text-grey-7">{{ merged.statusLabel }}</span>

      <button
        v-if="merged.needsConfirm"
        type="button"
        class="device-pair-contract__confirm-btn co21-glow-positive co21-glow-positive--pulse"
        :title="confirmTitle"
        :aria-label="confirmTitle"
        @click.stop="emit('confirm', device)"
      >
        <q-icon name="sync" size="14px" />
        <q-icon name="check" size="14px" />
      </button>

      <q-btn
        v-if="merged.hasPreview"
        dense
        flat
        no-caps
        color="primary"
        icon="visibility"
        :label="$text('sync.contract_preview_btn')"
        @click.stop="emit('preview', device)"
      />

      <q-btn
        v-if="merged.canResend && !merged.needsConfirm"
        dense
        flat
        round
        color="primary"
        icon="autorenew"
        :title="$text('sync.contract_resend')"
        @click.stop="emit('resend', device)"
      />
      <q-btn
        v-if="merged.canRemove && !merged.needsConfirm"
        dense
        flat
        round
        color="negative"
        icon="delete"
        :title="$text('sync.contract_remove')"
        @click.stop="emit('remove', device)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { $text } from 'src/modules/lang';
import {
  loadMergedDevicePairContract,
  type MergedDevicePairContract,
} from 'src/modules/storage/sync/syncDeviceContracts';
import type { ConnectedDevice } from 'src/modules/storage/sync/deviceRoleAssignment';
import { SYNC_CONTRACT_INCOMING_EVENT } from 'src/modules/storage/sync/syncContractIncoming';
import { PENDING_ACTIONS_CHANGED_EVENT } from 'src/modules/storage/sync/syncPendingActions';

const props = defineProps<{
  device: ConnectedDevice;
  refreshKey?: number;
}>();

const emit = defineEmits<{
  (e: 'preview', device: ConnectedDevice): void;
  (e: 'confirm', device: ConnectedDevice): void;
  (e: 'resend', device: ConnectedDevice): void;
  (e: 'remove', device: ConnectedDevice): void;
}>();

const merged = ref<MergedDevicePairContract | null>(null);
const loading = ref(false);

const confirmTitle = computed(() =>
  $text('sync.contract_confirm_btn').replace('{device}', props.device.name || '?'),
);

async function refresh(): Promise<void> {
  if (props.device.isLocal) return;
  loading.value = true;
  try {
    merged.value = await loadMergedDevicePairContract(props.device.id);
  } finally {
    loading.value = false;
  }
}

const onContractChanged = () => void refresh();

watch(() => props.refreshKey, () => void refresh());

onMounted(() => {
  void refresh();
  window.addEventListener('co21:sync-contract-signed', onContractChanged);
  window.addEventListener(PENDING_ACTIONS_CHANGED_EVENT, onContractChanged);
  window.addEventListener(SYNC_CONTRACT_INCOMING_EVENT, onContractChanged);
});

onBeforeUnmount(() => {
  window.removeEventListener('co21:sync-contract-signed', onContractChanged);
  window.removeEventListener(PENDING_ACTIONS_CHANGED_EVENT, onContractChanged);
  window.removeEventListener(SYNC_CONTRACT_INCOMING_EVENT, onContractChanged);
});

defineExpose({ refresh });
</script>

<style scoped>
.device-pair-contract__confirm-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  background: #21ba45;
  color: #fff;
  min-height: 28px;
}

.device-pair-contract__confirm-btn :deep(.q-icon) {
  color: #fff;
}
</style>
