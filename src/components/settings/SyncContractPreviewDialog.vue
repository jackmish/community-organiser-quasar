<template>
  <q-dialog v-model="dialogVisible" persistent v-bind="dialogBind">
    <q-card :class="cardClass" :style="cardStyle">
      <q-card-section class="row items-center q-gutter-sm q-pb-none">
        <q-icon name="sync_alt" color="primary" size="28px" />
        <div class="text-h6">{{ $text('sync.contract_preview_title') }}</div>
      </q-card-section>

      <q-card-section :class="bodyClass" :style="bodyStyle" class="q-pt-sm sync-contract-preview-body">
        <p class="text-caption text-grey-7 q-mb-md">
          {{ $text('sync.contract_preview_creator_note') }}
        </p>

        <template v-if="preview">
          <div v-if="!preview.sections.length" class="text-body2 text-grey-7 q-mb-md">
            {{ $text('sync.contract_preview_no_shared') }}
          </div>

          <div
            v-for="(section, sIdx) in preview.sections"
            :key="`${section.roleName}-${sIdx}`"
            class="sync-preview-section q-mb-md"
          >
            <div class="sync-preview-devices text-body2 q-mb-xs">
              <span
                v-for="(name, idx) in section.deviceNames"
                :key="name"
                class="sync-preview-device-name"
              >
                <span class="text-weight-medium">{{ idx + 1 }}.</span> {{ name }}
              </span>
            </div>

            <div class="sync-preview-headline text-subtitle2 text-weight-bold q-mb-sm">
              {{ section.headline }}
            </div>

            <div v-if="section.directGroups.length" class="sync-preview-chips">
              <span
                v-for="chip in section.directGroups"
                :key="chip.group.id"
                class="sync-preview-chip group-button"
                :style="chipBtnStyle(chip.group).wrap"
              >
                <q-icon
                  :name="chip.group.icon"
                  size="16px"
                  class="q-mr-xs"
                  :style="chipBtnStyle(chip.group).icon"
                />
                <span class="label-text">{{ chipLabel(chip) }}</span>
              </span>
            </div>

            <template v-for="bundle in section.inherited" :key="bundle.sourceGroup.id">
              <div class="sync-preview-inherited-head q-mt-sm q-mb-xs">
                <p class="text-caption q-mb-xs" style="color: rgba(0, 0, 0, 0.75)">
                  {{ inheritedScope(bundle.sourceGroup) }}
                </p>
                <p class="text-caption text-grey-7 q-mb-none">
                  {{ $text('sync.preview_inherited_current') }}
                </p>
              </div>
              <div class="sync-preview-chips">
                <span
                  v-for="chip in bundle.groups"
                  :key="chip.group.id"
                  class="sync-preview-chip group-button"
                  :style="chipBtnStyle(chip.group).wrap"
                >
                  <q-icon
                    :name="chip.group.icon"
                    size="16px"
                    class="q-mr-xs"
                    :style="chipBtnStyle(chip.group).icon"
                  />
                  <span class="label-text">{{ chipLabel(chip) }}</span>
                </span>
              </div>
            </template>
          </div>
        </template>

        <q-separator class="q-my-md" />

        <div class="row items-center q-gutter-md sync-contract-preview-options">
          <div class="row items-center q-gutter-sm col-auto">
            <q-input
              :model-value="intervalModel"
              type="number"
              dense
              outlined
              class="sync-contract-interval-input"
              style="width: 120px"
              :label="$text('sync.interval_label')"
              :min="minSyncInterval"
              :max="maxSyncInterval"
              @update:model-value="onIntervalInput"
            />
            <span class="text-caption sync-contract-interval-unit">
              {{ $text('sync.interval_unit') }}
            </span>
          </div>
          <div class="row items-center q-gutter-sm col sync-contract-duplicate-row">
            <span class="text-caption sync-contract-duplicate-label">
              {{ $text('sync.duplicate_resolution_label') }}
            </span>
            <q-radio
              v-model="duplicateLocal"
              val="auto"
              dense
              :label="$text('sync.duplicate_resolution_auto')"
            />
            <q-radio
              v-model="duplicateLocal"
              val="manual"
              dense
              :label="$text('sync.duplicate_resolution_manual')"
            />
          </div>
        </div>
      </q-card-section>

      <q-card-actions align="right" class="q-pt-none">
        <q-btn flat :label="$text('action.cancel')" @click="onCancel" />
        <q-btn
          unelevated
          color="positive"
          icon="check_circle"
          :label="$text('sync.contract_preview_send')"
          @click="onSend"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { $text } from 'src/modules/lang';
import {
  syncGroupChipButtonStyle,
  syncGroupChipLabel,
  syncInheritedScopeText,
  type SyncContractPreview,
  type SyncGroupChip,
  type SyncGroupVisual,
} from 'src/modules/storage/sync/syncContractPreview';
import {
  DEFAULT_SYNC_INTERVAL_SECONDS,
  DEFAULT_SYNC_DUPLICATE_RESOLUTION,
  MIN_SYNC_INTERVAL_SECONDS,
  MAX_SYNC_INTERVAL_SECONDS,
  type SyncDuplicateResolution,
} from 'src/modules/storage/sync/syncContractSettings';
import { useSettingsDialogLayout } from 'src/composables/useSettingsDialogLayout';

const props = defineProps<{
  modelValue: boolean;
  preview: SyncContractPreview | null;
  intervalSeconds?: number;
  duplicateResolution?: SyncDuplicateResolution;
  minSyncInterval?: number;
  maxSyncInterval?: number;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'update:intervalSeconds', v: number): void;
  (e: 'update:duplicateResolution', v: SyncDuplicateResolution): void;
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();

const { dialogBind, cardClass, cardStyle, bodyClass, bodyStyle } = useSettingsDialogLayout(560);

const dialogVisible = computed({
  get: () => !!props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

const minSyncInterval = computed(() => props.minSyncInterval ?? MIN_SYNC_INTERVAL_SECONDS);
const maxSyncInterval = computed(() => props.maxSyncInterval ?? MAX_SYNC_INTERVAL_SECONDS);

const intervalModel = computed(() => props.intervalSeconds ?? DEFAULT_SYNC_INTERVAL_SECONDS);

const duplicateLocal = computed({
  get: () => props.duplicateResolution ?? DEFAULT_SYNC_DUPLICATE_RESOLUTION,
  set: (v: SyncDuplicateResolution) => emit('update:duplicateResolution', v),
});

function onIntervalInput(v: string | number | null): void {
  const n = Math.min(
    maxSyncInterval.value,
    Math.max(minSyncInterval.value, Math.floor(Number(v) || DEFAULT_SYNC_INTERVAL_SECONDS)),
  );
  emit('update:intervalSeconds', n);
}

function chipLabel(chip: SyncGroupChip): string {
  return syncGroupChipLabel(chip);
}

function inheritedScope(group: SyncGroupVisual): string {
  return syncInheritedScopeText(group);
}

function chipBtnStyle(group: SyncGroupVisual) {
  return syncGroupChipButtonStyle(group);
}

function onSend(): void {
  emit('confirm');
  dialogVisible.value = false;
}

function onCancel(): void {
  emit('cancel');
  dialogVisible.value = false;
}
</script>

<style scoped>
.sync-contract-preview-body {
  color: rgba(0, 0, 0, 0.87);
}

.sync-preview-section {
  padding: 8px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.sync-preview-section:last-child {
  border-bottom: none;
}

.sync-preview-devices {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  line-height: 1.4;
}

.sync-preview-device-name {
  white-space: nowrap;
}

.sync-preview-headline {
  color: rgba(0, 0, 0, 0.9);
}

.sync-preview-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

/* Align with GroupButton.vue (task list shortcuts) */
.sync-preview-chip.group-button {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  padding: 2px 8px !important;
  min-height: 20px;
  border-radius: 6px;
  font-size: 0.88rem;
  line-height: 1.35;
  box-shadow: none !important;
  background-image: none !important;
}

.sync-preview-chip .label-text {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: inherit;
}

.sync-preview-inherited-head p {
  line-height: 1.35;
}

.sync-contract-interval-input :deep(.q-field__native),
.sync-contract-interval-input :deep(.q-field__input) {
  color: rgba(0, 0, 0, 0.87);
}

.sync-contract-interval-input :deep(.q-field__label) {
  color: rgba(0, 0, 0, 0.6);
}

.sync-contract-interval-unit {
  color: rgba(0, 0, 0, 0.7);
}

.sync-contract-preview-options {
  flex-wrap: wrap;
}

.sync-contract-duplicate-label {
  color: rgba(0, 0, 0, 0.7);
  white-space: nowrap;
}

.sync-contract-duplicate-row :deep(.q-radio__label) {
  color: rgba(0, 0, 0, 0.87);
}
</style>
