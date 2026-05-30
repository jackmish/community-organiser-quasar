<template>
  <div v-if="meteoEnabled" class="meteo-panel q-px-sm q-py-sm">
    <div class="row items-center no-wrap" style="gap: 10px">
      <q-icon :name="weatherIcon" size="28px" class="meteo-panel__icon" />
      <div class="col" style="min-width: 0">
        <div class="row items-center no-wrap" style="gap: 6px">
          <strong>{{ $text('meteo.title') }}</strong>
          <span v-if="locationName" class="text-caption meteo-panel__location">{{ locationName }}</span>
        </div>
        <div v-if="loading" class="text-caption meteo-panel__meta q-mt-xs">
          <q-spinner size="14px" class="q-mr-xs" />
          {{ $text('meteo.loading') }}
        </div>
        <div v-else-if="error && !snapshot" class="text-caption meteo-panel__meta q-mt-xs">
          {{ $text('meteo.error') }}
        </div>
        <div v-else-if="snapshot" class="row items-center q-mt-xs meteo-panel__stats" style="gap: 12px">
          <span class="meteo-panel__temp">{{ formatTemp(snapshot.current.temperature) }}</span>
          <span class="text-caption meteo-panel__meta">{{ weatherLabel }}</span>
          <span class="text-caption meteo-panel__meta">
            {{ $text('meteo.humidity').replace('{value}', String(snapshot.current.humidity)) }}
          </span>
          <span class="text-caption meteo-panel__meta">
            {{ $text('meteo.wind').replace('{value}', snapshot.current.windSpeed.toFixed(1)) }}
          </span>
        </div>
      </div>
      <q-btn
        flat
        dense
        round
        icon="refresh"
        color="white"
        :loading="loading"
        :aria-label="$text('meteo.refresh')"
        @click="void loadForecast(true)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { $text } from 'src/modules/lang';
import {
  METEO_SYNC_CHANGED_EVENT,
  loadMeteoSyncEnabled,
} from 'src/modules/time/meteoSyncSettings';
import {
  describeWeatherCode,
  refreshMeteoData,
  type MeteoSnapshot,
} from 'src/modules/time/meteoService';

const meteoEnabled = ref(false);
const loading = ref(false);
const error = ref(false);
const snapshot = ref<MeteoSnapshot | null>(null);
let refreshTimer: ReturnType<typeof setInterval> | null = null;

const locationName = computed(() => snapshot.value?.location.name ?? '');
const weatherMeta = computed(() =>
  snapshot.value ? describeWeatherCode(snapshot.value.current.weatherCode) : null,
);
const weatherIcon = computed(() => weatherMeta.value?.icon ?? 'cloud');
const weatherLabel = computed(() =>
  weatherMeta.value ? $text(weatherMeta.value.labelKey) : '',
);

function formatTemp(value: number): string {
  return `${Math.round(value)}°`;
}

async function loadForecast(force = false): Promise<void> {
  if (!meteoEnabled.value) return;
  loading.value = true;
  error.value = false;
  try {
    const data = await refreshMeteoData(force);
    snapshot.value = data;
    if (!data) error.value = true;
  } catch {
    error.value = true;
  } finally {
    loading.value = false;
  }
}

function onMeteoSyncChanged(ev: Event): void {
  const ce = ev as CustomEvent<{ enabled?: boolean }>;
  meteoEnabled.value = !!ce.detail?.enabled;
  if (meteoEnabled.value) {
    void loadForecast(true);
  } else {
    snapshot.value = null;
    error.value = false;
  }
}

onMounted(async () => {
  meteoEnabled.value = await loadMeteoSyncEnabled();
  if (meteoEnabled.value) {
    await loadForecast(false);
    refreshTimer = setInterval(() => {
      if (meteoEnabled.value) void loadForecast(false);
    }, 30 * 60 * 1000);
  }
  window.addEventListener(METEO_SYNC_CHANGED_EVENT, onMeteoSyncChanged as EventListener);
});

onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer);
  window.removeEventListener(METEO_SYNC_CHANGED_EVENT, onMeteoSyncChanged as EventListener);
});
</script>

<style scoped>
.meteo-panel {
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 0 0 8px 8px;
  background: rgba(2, 119, 189, 0.82);
  color: #fff;
}

.meteo-panel__icon {
  color: rgba(255, 255, 255, 0.95);
}

.meteo-panel__location {
  color: rgba(255, 255, 255, 0.78);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meteo-panel__meta {
  color: rgba(255, 255, 255, 0.85);
}

.meteo-panel__temp {
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1;
}

.meteo-panel__stats {
  flex-wrap: wrap;
}
</style>
