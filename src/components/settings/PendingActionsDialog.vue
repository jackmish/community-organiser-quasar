<template>
  <q-dialog v-model="dialogVisible" v-bind="dialogBind">
    <q-card :class="cardClass" :style="cardStyle" class="pending-actions-card">
      <q-card-section class="row items-center q-gutter-sm q-pb-none" :class="headerClass">
        <q-icon name="hourglass_top" color="primary" size="28px" />
        <div class="text-h6">{{ $text('sync.pending_actions_title') }}</div>
      </q-card-section>

      <q-card-section :class="bodyClass" :style="bodyStyle" class="pending-actions-body">
        <div v-if="!actions.length && !syncRuns.length" class="text-body2 text-grey-7">
          {{ $text('sync.pending_actions_empty') }}
        </div>

        <div v-if="syncRuns.length" class="q-mb-md">
          <div class="text-subtitle2 text-weight-medium q-mb-sm">
            {{ $text('sync.runs_section_title') }}
          </div>
          <div class="pending-actions-list column q-gutter-sm">
            <div v-for="run in syncRunsNewestFirst" :key="run.id" class="pending-action-card">
              <div class="row items-center q-gutter-sm q-mb-xs">
                <div class="text-subtitle2 text-weight-medium">{{ run.peerDeviceName }}</div>
                <q-badge :color="runStatusColor(run.status)" :label="runStatusLabel(run.status)" />
                <q-badge
                  v-if="run.incremental"
                  color="grey-7"
                  outline
                  :label="$text('sync.run_incremental')"
                />
              </div>
              <div class="text-caption text-grey-8">
                {{ runStartedLabel(run) }}
                <span v-if="run.finishedAt"> · {{ runFinishedLabel(run) }}</span>
              </div>
              <div v-if="run.message" class="text-caption text-grey-7 q-mt-xs">
                {{ run.message }}
                <span v-if="run.groupsReceived != null">
                  · {{ $text('sync.run_stats') }}
                  ↑{{ run.groupsSent ?? 0 }}/{{ run.tasksSent ?? 0 }}
                  ↓{{ run.groupsReceived }}/{{ run.tasksReceived ?? 0 }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="actions.length" class="pending-actions-list column q-gutter-md">
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
import type { SyncRunRecord, SyncRunStatus } from 'src/modules/storage/sync/syncRunQueue';
import { useSettingsDialogLayout } from 'src/composables/useSettingsDialogLayout';

const props = defineProps<{
  modelValue: boolean;
  actions: SyncPendingAction[];
  syncRuns?: SyncRunRecord[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'run-now', id: string): void;
  (e: 'cancel', id: string): void;
}>();

const { dialogBind, cardClass, cardStyle, headerClass, bodyClass, bodyStyle } =
  useSettingsDialogLayout(760, 900);

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

const syncRuns = computed(() => props.syncRuns ?? []);

const syncRunsNewestFirst = computed(() =>
  [...syncRuns.value].sort((a, b) => (b.finishedAt ?? b.createdAt) - (a.finishedAt ?? a.createdAt)),
);

function runStatusColor(status: SyncRunStatus): string {
  if (status === 'ok') return 'positive';
  if (status === 'failed') return 'negative';
  if (status === 'running') return 'primary';
  return 'grey-7';
}

function runStatusLabel(status: SyncRunStatus): string {
  const key = `sync.run_status_${status}` as 'sync.run_status_ok';
  return $text(key);
}

function runStartedLabel(run: SyncRunRecord): string {
  const t = run.startedAt ?? run.createdAt;
  return $text('sync.run_started').replace('{time}', new Date(t).toLocaleString());
}

function runFinishedLabel(run: SyncRunRecord): string {
  if (!run.finishedAt) return '';
  return $text('sync.run_finished').replace('{time}', new Date(run.finishedAt).toLocaleString());
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
