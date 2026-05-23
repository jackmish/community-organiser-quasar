<template>
  <q-dialog v-model="dialogVisible" persistent v-bind="dialogBind">
    <q-card :class="[cardClass, 'sync-contract-confirm-card']" :style="cardStyle">
      <q-card-section
        class="sync-contract-confirm-card__header row items-center q-gutter-sm"
        :class="headerClass"
      >
        <q-icon name="rule" color="white" size="28px" />
        <div class="text-h6 text-white">{{ $text('sync.contract_confirm_title') }}</div>
      </q-card-section>

      <q-card-section class="sync-contract-confirm-card__body q-pt-md">
        <div class="row items-center q-gutter-sm q-mb-md">
          <q-input
            :model-value="intervalModel"
            type="number"
            dense
            outlined
            class="col sync-contract-interval-input"
            :label="$text('sync.interval_label')"
            :min="minSyncInterval"
            :max="maxSyncInterval"
            @update:model-value="onIntervalInput"
          />
          <span class="text-caption sync-contract-interval-unit col-auto">
            {{ $text('sync.interval_unit') }}
          </span>
        </div>

        <p class="text-body2 q-mb-md">{{ $text('sync.contract_confirm_intro') }}</p>
        <q-checkbox
          v-model="understood"
          :label="$text('sync.contract_confirm_checkbox')"
          color="positive"
        />
      </q-card-section>

      <q-card-actions align="right" class="sync-contract-confirm-card__actions">
        <q-btn flat :label="$text('action.cancel')" @click="onCancel" />
        <q-btn
          unelevated
          color="positive"
          text-color="white"
          :label="$text('sync.contract_confirm_continue')"
          :disable="!understood"
          @click="onContinue"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { $text } from 'src/modules/lang';
import {
  DEFAULT_SYNC_INTERVAL_SECONDS,
  MIN_SYNC_INTERVAL_SECONDS,
  MAX_SYNC_INTERVAL_SECONDS,
} from 'src/modules/storage/sync/syncContractSettings';
import { useSettingsDialogLayout } from 'src/composables/useSettingsDialogLayout';

const props = defineProps<{
  modelValue: boolean;
  intervalSeconds?: number;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'update:intervalSeconds', v: number): void;
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();

const { dialogBind, cardClass, cardStyle, headerClass } = useSettingsDialogLayout(400);

const dialogVisible = computed({
  get: () => !!props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

const minSyncInterval = MIN_SYNC_INTERVAL_SECONDS;
const maxSyncInterval = MAX_SYNC_INTERVAL_SECONDS;

const intervalModel = computed(() => props.intervalSeconds ?? DEFAULT_SYNC_INTERVAL_SECONDS);

function onIntervalInput(v: string | number | null): void {
  const n = Math.min(
    MAX_SYNC_INTERVAL_SECONDS,
    Math.max(MIN_SYNC_INTERVAL_SECONDS, Math.floor(Number(v) || DEFAULT_SYNC_INTERVAL_SECONDS)),
  );
  emit('update:intervalSeconds', n);
}

const understood = ref(false);

watch(
  () => props.modelValue,
  (open) => {
    if (open) understood.value = false;
  },
);

function onContinue(): void {
  emit('confirm');
  dialogVisible.value = false;
}

function onCancel(): void {
  emit('cancel');
  dialogVisible.value = false;
}
</script>

<style scoped>
.sync-contract-confirm-card__header {
  background: var(--q-positive);
}

.sync-contract-confirm-card__body {
  background: #fff;
  color: rgba(0, 0, 0, 0.87);
}

.sync-contract-confirm-card__actions {
  background: #f5f5f5;
  color: rgba(0, 0, 0, 0.87);
}

.sync-contract-interval-unit {
  color: rgba(0, 0, 0, 0.7);
}

.sync-contract-interval-input :deep(.q-field__native),
.sync-contract-interval-input :deep(.q-field__input) {
  color: rgba(0, 0, 0, 0.87);
}

.sync-contract-interval-input :deep(.q-field__label) {
  color: rgba(0, 0, 0, 0.6);
}

.sync-contract-confirm-card__body :deep(.q-checkbox__label) {
  color: rgba(0, 0, 0, 0.87);
}
</style>
