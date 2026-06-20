<template>
  <q-expansion-item
    expand-separator
    icon="hourglass_top"
    :label="$text('debug.load_timings.title')"
    :caption="$text('debug.load_timings.caption')"
    header-class="text-weight-medium"
  >
    <div class="q-pa-md">
      <div v-if="!lastRunTotal" class="text-caption text-grey-7 q-mb-md">
        {{ $text('debug.load_timings.no_data') }}
      </div>

      <div v-else class="q-mb-md">
        <div class="text-subtitle2 q-mb-xs">{{ $text('debug.load_timings.last_run') }}</div>
        <div class="text-caption text-grey-7 q-mb-sm">
          {{ $text('debug.load_timings.total').replace('{time}', formatLoadMs(lastRunTotal)) }}
        </div>
        <q-markup-table dense flat bordered class="app-load-timings-table">
          <thead>
            <tr>
              <th class="text-left">{{ $text('debug.load_timings.phase') }}</th>
              <th class="text-right">{{ $text('debug.load_timings.duration') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in lastRunRows" :key="row.id">
              <td>{{ row.label }}</td>
              <td class="text-right">{{ formatLoadMs(row.ms) }}</td>
            </tr>
          </tbody>
        </q-markup-table>
      </div>

      <div v-if="historyRows.length">
        <div class="text-subtitle2 q-mb-sm">{{ $text('debug.load_timings.history') }}</div>
        <q-list dense bordered separator class="rounded-borders">
          <q-expansion-item
            v-for="(run, index) in historyRows"
            :key="run.at + index"
            dense
            :label="run.label"
            :caption="run.caption"
          >
            <q-markup-table dense flat class="q-ma-sm">
              <tbody>
                <tr v-for="phase in run.phases" :key="phase.id">
                  <td>{{ phase.label }}</td>
                  <td class="text-right">{{ formatLoadMs(phase.ms) }}</td>
                </tr>
              </tbody>
            </q-markup-table>
          </q-expansion-item>
        </q-list>
      </div>
    </div>
  </q-expansion-item>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { $text } from 'src/modules/lang';
import {
  formatLoadMs,
  LOAD_PHASES,
  loadTimingsForDebug,
  type LoadPhaseId,
} from 'src/composables/appLoadProgress';

function phaseLabel(id: LoadPhaseId): string {
  const def = LOAD_PHASES.find((p) => p.id === id);
  return def ? $text(def.labelKey) : id;
}

const lastRunRows = computed(() =>
  LOAD_PHASES.map((phase) => ({
    id: phase.id,
    label: $text(phase.labelKey),
    ms: loadTimingsForDebug.value.lastRun[phase.id],
  })).filter((row) => (row.ms ?? 0) > 0),
);

const lastRunTotal = computed(() =>
  lastRunRows.value.reduce((sum, row) => sum + (row.ms ?? 0), 0),
);

const historyRows = computed(() =>
  loadTimingsForDebug.value.runs.map((run) => {
    const phases = LOAD_PHASES.map((phase) => ({
      id: phase.id,
      label: phaseLabel(phase.id),
      ms: run.phases[phase.id],
    })).filter((p) => (p.ms ?? 0) > 0);

    const when = new Date(run.at);
    const label = Number.isNaN(when.getTime())
      ? run.at
      : when.toLocaleString();

    const caption = run.completed
      ? $text('debug.load_timings.run_completed').replace('{time}', formatLoadMs(run.totalMs))
      : $text('debug.load_timings.run_partial').replace('{time}', formatLoadMs(run.totalMs));

    return { at: run.at, label, caption, phases };
  }),
);
</script>

<style scoped lang="scss">
.app-load-timings-table {
  background: #fafafa;
}
</style>
