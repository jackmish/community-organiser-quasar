<template>
  <q-dialog v-model="dialogVisible" v-bind="dialogBind">
    <q-card :class="cardClass" :style="cardStyle" class="pending-actions-card">
      <q-card-section class="row items-center q-gutter-sm q-pb-none">
        <q-icon name="hourglass_top" color="primary" size="28px" />
        <div class="text-h6">{{ $text('sync.pending_actions_title') }}</div>
      </q-card-section>

      <q-card-section :class="bodyClass" :style="bodyStyle" class="pending-actions-body">
        <div v-if="!actions.length" class="text-body2 text-grey-7">
          {{ $text('sync.pending_actions_empty') }}
        </div>

        <div v-else class="pending-actions-list column q-gutter-md">
          <div
            v-for="action in actions"
            :key="action.id"
            class="pending-action-card"
          >
            <div class="pending-action-card__main row items-start q-col-gutter-md">
              <div class="col">
                <div class="row items-center q-gutter-sm q-mb-xs">
                  <div class="text-subtitle2 text-weight-medium">
                    {{ actionTitle(action) }}
                  </div>
                  <q-badge
                    v-if="action.deliveredAt"
                    color="positive"
                    :label="$text('sync.pending_action_delivered')"
                  />
                  <q-badge
                    v-else
                    color="grey-7"
                    :label="$text('sync.pending_action_queued')"
                  />
                  <q-badge
                    v-if="failCount(action) > 0"
                    color="negative"
                    outline
                    :label="failCountLabel(action)"
                  />
                </div>
                <div class="text-caption text-grey-8">
                  {{ actionTargetsLine(action) }}
                </div>
                <div v-if="action.kind === 'send_contract'" class="text-caption text-grey-7 q-mt-xs">
                  {{ $text('sync.pending_action_interval') }}:
                  {{ action.intervalSeconds }} {{ $text('sync.interval_unit') }}
                  <span v-if="action.lastAttemptAt" class="q-ml-sm">
                    · {{ lastAttemptLabel(action) }}
                  </span>
                </div>
              </div>
              <div class="col-auto column q-gutter-xs pending-action-card__actions">
                <q-btn
                  dense
                  unelevated
                  color="positive"
                  icon="play_arrow"
                  :label="$text('sync.pending_action_run_now')"
                  @click="emit('run-now', action.id)"
                />
                <q-btn
                  dense
                  flat
                  color="negative"
                  icon="close"
                  :label="$text('sync.pending_action_cancel')"
                  @click="emit('cancel', action.id)"
                />
              </div>
            </div>
          </div>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="$text('action.close')" color="primary" @click="dialogVisible = false" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { $text } from 'src/modules/lang';
import type { SyncPendingAction } from 'src/modules/storage/sync/syncPendingActions';
import { useSettingsDialogLayout } from 'src/composables/useSettingsDialogLayout';

const props = defineProps<{
  modelValue: boolean;
  actions: SyncPendingAction[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'run-now', id: string): void;
  (e: 'cancel', id: string): void;
}>();

const { dialogBind, cardClass, cardStyle, bodyClass, bodyStyle } = useSettingsDialogLayout(760);

const dialogVisible = computed({
  get: () => !!props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

function actionTitle(action: SyncPendingAction): string {
  if (action.kind === 'send_contract') {
    return $text('sync.pending_action_send_contract');
  }
  return action.kind;
}

function failCount(action: SyncPendingAction): number {
  return action.deliveryFailCount ?? 0;
}

function failCountLabel(action: SyncPendingAction): string {
  const n = failCount(action);
  const raw = $text('sync.pending_action_fail_count');
  return raw.replace('{count}', String(n));
}

function actionTargetsLine(action: SyncPendingAction): string {
  const names = action.targets.map((t) => t.deviceName).join(', ');
  return names || '—';
}

function lastAttemptLabel(action: SyncPendingAction): string {
  if (!action.lastAttemptAt) return '';
  const raw = $text('sync.pending_action_last_attempt');
  return raw.replace('{time}', new Date(action.lastAttemptAt).toLocaleString());
}
</script>

<style scoped>
/* Body area: light panel distinct from blue dialog chrome (overrides global dialog card-section). */
.pending-actions-body {
  color: rgba(0, 0, 0, 0.87) !important;
  background: #e8ecf0 !important;
}

.pending-actions-list {
  padding: 4px 0;
}

.pending-action-card {
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  padding: 12px 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.pending-action-card__actions {
  min-width: 140px;
}

@media (max-width: 599px) {
  .pending-action-card__main {
    flex-direction: column;
  }

  .pending-action-card__actions {
    flex-direction: row !important;
    width: 100%;
  }
}
</style>
