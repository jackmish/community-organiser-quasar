<template>
  <div class="meteo-debug-panel debug-tools-surface">
    <div
      class="meteo-debug-panel__toolbar"
      :class="mobile ? 'column items-stretch q-gutter-y-sm' : 'row items-center q-gutter-sm'"
    >
      <div class="text-subtitle2" :class="{ 'text-center': mobile }">Weather sync</div>
      <q-space v-if="!mobile" />
      <div
        :class="
          mobile ? 'column items-stretch q-gutter-y-xs' : 'row items-center q-gutter-xs no-wrap'
        "
      >
        <q-btn
          flat
          :dense="!mobile"
          icon="refresh"
          label="Refresh"
          class="meteo-debug-panel__action-btn"
          :loading="refreshing"
          @click="onRefresh"
        />
        <q-btn
          flat
          :dense="!mobile"
          icon="delete_sweep"
          label="Clear cache"
          class="meteo-debug-panel__action-btn"
          :loading="clearing"
          @click="onClearCache"
        />
      </div>
    </div>

    <div class="text-caption q-mb-sm meteo-debug-panel__hint">
      Open-Meteo requests appear in the LAN log above (native HTTP on Android). Check transport,
      status code, and response body if sync fails.
    </div>

    <q-markup-table dense flat bordered class="meteo-debug-panel__table rounded-borders">
      <tbody>
        <tr v-for="row in rows" :key="row.label">
          <td class="text-weight-medium">{{ row.label }}</td>
          <td :class="row.tone">{{ row.value }}</td>
        </tr>
      </tbody>
    </q-markup-table>

    <div v-if="state.lastError" class="q-mt-sm text-caption text-negative">
      Last error: {{ state.lastError }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  clearMeteoCache,
  meteoDebugState,
  meteoTodayDateKey,
  refreshMeteoData,
} from 'src/modules/time/meteoService';
import { Notify } from 'quasar';

defineProps<{ mobile?: boolean }>();

const refreshing = ref(false);
const clearing = ref(false);

const state = computed(() => meteoDebugState.value);

const rows = computed(() => {
  const s = state.value;
  const dateMismatch =
    s.cacheFirstDay && s.deviceDate && s.cacheFirstDay !== s.deviceDate ? 'text-negative' : '';
  return [
    { label: 'Sync enabled', value: s.syncEnabled ? 'yes' : 'no', tone: '' },
    { label: 'Device date', value: s.deviceDate || meteoTodayDateKey(), tone: '' },
    { label: 'Last source', value: s.lastSource, tone: sourceTone(s.lastSource) },
    { label: 'Location', value: s.locationName || '—', tone: '' },
    {
      label: 'Cache first day',
      value: s.cacheFirstDay || '—',
      tone: dateMismatch,
    },
    {
      label: 'Cache age',
      value: s.cacheAgeMin != null ? `${s.cacheAgeMin} min` : '—',
      tone: '',
    },
    {
      label: 'Last fetch',
      value: s.lastFetchAt ? new Date(s.lastFetchAt).toLocaleString() : '—',
      tone: '',
    },
    {
      label: 'Last HTTP status',
      value: s.lastHttpStatus != null ? String(s.lastHttpStatus) : '—',
      tone: httpTone(s.lastHttpStatus),
    },
  ];
});

function sourceTone(source: string): string {
  if (source === 'network' || source === 'fresh-cache') return 'text-positive';
  if (source === 'stale-cache') return 'text-warning';
  if (source === 'failed') return 'text-negative';
  return '';
}

function httpTone(status: number | null): string {
  if (status == null) return '';
  if (status >= 200 && status < 300) return 'text-positive';
  if (status === 429) return 'text-negative';
  if (status >= 400 || status === 0) return 'text-negative';
  return '';
}

async function onRefresh(): Promise<void> {
  refreshing.value = true;
  try {
    const snapshot = await refreshMeteoData(true);
    Notify.create({
      type: snapshot ? 'positive' : 'negative',
      message: snapshot ? 'Weather refreshed' : 'Weather refresh failed — see log',
      timeout: 2500,
    });
  } finally {
    refreshing.value = false;
  }
}

async function onClearCache(): Promise<void> {
  clearing.value = true;
  try {
    await clearMeteoCache();
    Notify.create({
      type: 'positive',
      message: 'Weather cache cleared',
      timeout: 2000,
    });
  } finally {
    clearing.value = false;
  }
}
</script>

<style scoped lang="scss">
.debug-tools-surface {
  background: #fff;
  color: #212121;
}

.meteo-debug-panel__hint {
  color: #616161;
  line-height: 1.35;
}

.meteo-debug-panel__table {
  background: #fff;
}

.meteo-debug-panel__table td {
  word-break: break-word;
}

.meteo-debug-panel__action-btn {
  align-self: stretch;
}
</style>
