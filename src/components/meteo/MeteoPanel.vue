<template>
  <div
    v-if="meteoEnabled"
    class="meteo-panel q-px-sm q-py-sm"
    :class="{ 'meteo-panel--colorize': panelTheme.colorize }"
    :style="panelStyle"
  >
    <div class="row items-center no-wrap meteo-panel__header" style="gap: 8px">
      <div class="col" style="min-width: 0">
        <strong>{{ $text('meteo.title') }}</strong>
      </div>
      <q-btn
        flat
        dense
        round
        icon="refresh"
        :style="{ color: panelTheme.fg }"
        :loading="loading"
        :aria-label="$text('meteo.refresh')"
        @click="void loadForecast(true)"
      />
    </div>

    <div v-if="loading && !snapshot" class="text-caption meteo-panel__muted q-mt-sm">
      <q-spinner size="14px" class="q-mr-xs" />
      {{ $text('meteo.loading') }}
    </div>
    <div v-else-if="error && !snapshot" class="text-caption meteo-panel__muted q-mt-sm">
      {{ $text('meteo.error') }}
    </div>

    <template v-else-if="snapshot">
      <div class="row q-col-gutter-sm q-mt-sm meteo-panel__now-row">
        <div class="col-12 col-sm-6 meteo-panel__now">
          <div class="row items-center no-wrap" style="gap: 12px">
            <q-icon :name="weatherIcon" size="42px" class="meteo-panel__now-icon" />
            <div>
              <div class="meteo-panel__now-label">{{ $text('meteo.now') }}</div>
              <div class="meteo-panel__now-temp">{{ formatTemp(snapshot.current.temperature) }}</div>
              <div class="text-body2 meteo-panel__muted">{{ weatherLabel }}</div>
            </div>
          </div>
          <div class="row q-mt-sm meteo-panel__now-stats" style="gap: 14px">
            <span class="meteo-panel__stat">
              {{ $text('meteo.humidity').replace('{value}', String(snapshot.current.humidity)) }}
            </span>
            <span class="meteo-panel__stat">
              {{ $text('meteo.wind').replace('{value}', snapshot.current.windSpeed.toFixed(1)) }}
            </span>
            <span class="meteo-panel__stat meteo-panel__stat--rain">
              {{ $text('meteo.rain_chance').replace('{value}', String(snapshot.current.rainChance)) }}
            </span>
          </div>
        </div>

        <div class="col-12 col-sm-6 meteo-panel__location-col">
          <q-select
            v-model="selectedLocation"
            class="meteo-panel__location-select"
            :options="cityOptions"
            option-label="name"
            use-input
            fill-input
            hide-selected
            input-debounce="400"
            dense
            outlined
            :label="$text('meteo.location_search')"
            :loading="searchLoading"
            :disable="locationSaving"
            @filter="filterCities"
            @update:model-value="onLocationPicked"
          >
            <template #no-option>
              <q-item>
                <q-item-section class="text-grey">
                  {{ citySearchHint }}
                </q-item-section>
              </q-item>
            </template>
          </q-select>

          <div class="row items-center q-mt-xs meteo-panel__location-actions" style="gap: 4px">
            <q-btn
              v-for="loc in recentLocations"
              :key="locationKey(loc)"
              dense
              no-caps
              size="sm"
              class="meteo-panel__recent-btn"
              :class="{ 'meteo-panel__recent-btn--active': isActiveLocation(loc) }"
              :label="shortLocationLabel(loc.name)"
              :disable="locationSaving || loading"
              @click="void applyLocation(loc)"
            />
            <q-btn
              dense
              round
              flat
              icon="my_location"
              size="sm"
              :style="{ color: panelTheme.fg }"
              :loading="gpsLoading"
              :disable="locationSaving || loading"
              :aria-label="$text('meteo.location_gps')"
              @click="void useDeviceLocation()"
            >
              <q-tooltip>{{ $text('meteo.location_gps') }}</q-tooltip>
            </q-btn>
          </div>
        </div>
      </div>

      <div v-for="day in snapshot.days" :key="day.date" class="meteo-panel__day q-mt-md">
        <div class="text-caption text-weight-bold meteo-panel__day-title q-mb-xs">
          {{ dayLabel(day) }}
        </div>
        <div class="meteo-panel__hours">
          <div
            v-for="slot in day.hours"
            :key="slot.time"
            class="meteo-panel__hour"
            :class="{ 'meteo-panel__hour--eod': slot.hour === 24 }"
          >
            <div class="meteo-panel__hour-time">{{ formatHourLabel(slot.hour) }}</div>
            <q-icon :name="hourIcon(slot.weatherCode)" size="16px" class="meteo-panel__hour-icon" />
            <div class="meteo-panel__hour-temp">{{ formatTemp(slot.temperature) }}</div>
            <div class="meteo-panel__hour-rain">{{ slot.rainChance }}%</div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { $text } from 'src/modules/lang';
import { formatAppWeekday } from 'src/modules/lang/dateFormat';
import CC from 'src/CCAccess';
import {
  readGroupBackgroundFields,
  isGroupBackgroundColorizeActive,
} from 'src/modules/group/utils/groupBackground';
import { darkenHex, getContrastColor, hexToRgba } from 'src/utils/colorUtils';
import {
  METEO_SYNC_CHANGED_EVENT,
  METEO_LOCATION_CHANGED_EVENT,
  loadMeteoSyncEnabled,
  loadMeteoLocation,
  loadMeteoRecentLocations,
  saveMeteoLocationSelection,
  meteoLocationsMatch,
} from 'src/modules/time/meteoSyncSettings';
import {
  describeWeatherCode,
  refreshMeteoData,
  resolveDeviceMeteoLocation,
  searchMeteoCities,
  type MeteoDayForecast,
  type MeteoLocation,
  type MeteoSnapshot,
} from 'src/modules/time/meteoService';

const METEO_DEFAULT_BG = 'rgba(2, 119, 189, 0.82)';
const METEO_DEFAULT_FG = '#ffffff';

const meteoEnabled = ref(false);
const loading = ref(false);
const error = ref(false);
const snapshot = ref<MeteoSnapshot | null>(null);
const selectedLocation = ref<MeteoLocation | null>(null);
const recentLocations = ref<MeteoLocation[]>([]);
const cityOptions = ref<MeteoLocation[]>([]);
const searchLoading = ref(false);
const locationSaving = ref(false);
const gpsLoading = ref(false);
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let citySearchToken = 0;

const citySearchHint = computed(() =>
  searchLoading.value ? $text('meteo.loading') : $text('meteo.location_type_hint'),
);

const activeGroupRecord = computed((): Record<string, unknown> | null => {
  try {
    const gid = CC.group.active.activeGroup.value?.value ?? null;
    if (!gid) return null;
    const list = CC.group.list.all.value ?? [];
    const g = list.find((x) => String(x?.id) === String(gid));
    return g && typeof g === 'object' ? (g as unknown as Record<string, unknown>) : null;
  } catch {
    return null;
  }
});

const panelTheme = computed(() => {
  const group = activeGroupRecord.value;
  const colorize = isGroupBackgroundColorizeActive(group);
  const { color, textColor } = readGroupBackgroundFields(group);
  const fg = textColor || getContrastColor(color);
  return { colorize, color, fg };
});

const panelStyle = computed(() => {
  if (!panelTheme.value.colorize) {
    return { backgroundColor: METEO_DEFAULT_BG, color: METEO_DEFAULT_FG };
  }
  const bg = hexToRgba(darkenHex(panelTheme.value.color, 0.1), 0.9);
  return {
    backgroundColor: bg,
    color: panelTheme.value.fg,
  };
});

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

function formatHourLabel(hour: number): string {
  return hour === 24 ? '24' : String(hour);
}

function hourIcon(code: number): string {
  return describeWeatherCode(code).icon;
}

function locationKey(loc: MeteoLocation): string {
  return `${loc.latitude.toFixed(3)}:${loc.longitude.toFixed(3)}`;
}

function shortLocationLabel(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= 14) return trimmed;
  return `${trimmed.slice(0, 12)}…`;
}

function isActiveLocation(loc: MeteoLocation): boolean {
  if (!selectedLocation.value) return false;
  return meteoLocationsMatch(loc, selectedLocation.value);
}

function dayLabel(day: MeteoDayForecast): string {
  if (day.dayIndex === 0) return $text('meteo.day.today');
  if (day.dayIndex === 1) return $text('meteo.day.tomorrow');
  const parts = day.date.split('-').map(Number);
  const [year, month, dayNum] = parts;
  if (parts.length === 3 && year && month && dayNum) {
    const date = new Date(year, month - 1, dayNum);
    return formatAppWeekday(date, 'short');
  }
  return day.date;
}

async function loadLocationState(): Promise<void> {
  selectedLocation.value = await loadMeteoLocation();
  recentLocations.value = await loadMeteoRecentLocations();
  if (!selectedLocation.value && snapshot.value?.location) {
    selectedLocation.value = snapshot.value.location;
  }
}

async function loadForecast(force = false): Promise<void> {
  if (!meteoEnabled.value) return;
  loading.value = true;
  error.value = false;
  try {
    const data = await refreshMeteoData(force);
    snapshot.value = data;
    if (!data) {
      error.value = true;
      return;
    }
    if (!selectedLocation.value) {
      selectedLocation.value = data.location;
    }
  } catch {
    error.value = true;
  } finally {
    loading.value = false;
  }
}

async function applyLocation(location: MeteoLocation): Promise<void> {
  locationSaving.value = true;
  try {
    const ok = await saveMeteoLocationSelection(location);
    if (!ok) return;
    selectedLocation.value = location;
    recentLocations.value = await loadMeteoRecentLocations();
    await loadForecast(true);
  } finally {
    locationSaving.value = false;
  }
}

function onLocationPicked(location: MeteoLocation | null): void {
  if (!location || locationSaving.value) return;
  if (snapshot.value?.location && meteoLocationsMatch(location, snapshot.value.location)) return;
  void applyLocation(location);
}

async function useDeviceLocation(): Promise<void> {
  gpsLoading.value = true;
  try {
    const device = await resolveDeviceMeteoLocation();
    if (!device) return;
    await applyLocation(device);
  } finally {
    gpsLoading.value = false;
  }
}

function filterCities(
  val: string,
  update: (callback: () => void) => void,
  abort: () => void,
): void {
  const query = val.trim();
  if (query.length < 2) {
    update(() => {
      cityOptions.value = [...recentLocations.value];
    });
    abort();
    return;
  }

  const token = ++citySearchToken;
  searchLoading.value = true;
  void searchMeteoCities(query)
    .then((results) => {
      if (token !== citySearchToken) return;
      update(() => {
        cityOptions.value = results;
      });
    })
    .finally(() => {
      if (token === citySearchToken) searchLoading.value = false;
    });
}

function onMeteoSyncChanged(ev: Event): void {
  const ce = ev as CustomEvent<{ enabled?: boolean }>;
  meteoEnabled.value = !!ce.detail?.enabled;
  if (meteoEnabled.value) {
    void loadLocationState().then(() => loadForecast(true));
  } else {
    snapshot.value = null;
    error.value = false;
  }
}

function onMeteoLocationChanged(ev: Event): void {
  const ce = ev as CustomEvent<{ location?: MeteoLocation }>;
  if (ce.detail?.location) {
    selectedLocation.value = ce.detail.location;
  }
  void loadMeteoRecentLocations().then((items) => {
    recentLocations.value = items;
  });
}

onMounted(async () => {
  meteoEnabled.value = await loadMeteoSyncEnabled();
  if (meteoEnabled.value) {
    await loadLocationState();
    await loadForecast(false);
    refreshTimer = setInterval(() => {
      if (meteoEnabled.value) void loadForecast(false);
    }, 30 * 60 * 1000);
  }
  window.addEventListener(METEO_SYNC_CHANGED_EVENT, onMeteoSyncChanged as EventListener);
  window.addEventListener(METEO_LOCATION_CHANGED_EVENT, onMeteoLocationChanged as EventListener);
});

onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer);
  window.removeEventListener(METEO_SYNC_CHANGED_EVENT, onMeteoSyncChanged as EventListener);
  window.removeEventListener(METEO_LOCATION_CHANGED_EVENT, onMeteoLocationChanged as EventListener);
});
</script>

<style scoped>
.meteo-panel {
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 0 0 8px 8px;
}

.meteo-panel__muted {
  opacity: 0.82;
}

.meteo-panel__header strong {
  font-size: 0.95rem;
}

.meteo-panel__now-row {
  align-items: flex-start;
}

.meteo-panel__location-col {
  min-width: 0;
}

.meteo-panel__location-select :deep(.q-field__control) {
  background: rgba(255, 255, 255, 0.12);
}

.meteo-panel__location-select :deep(.q-field__label),
.meteo-panel__location-select :deep(.q-field__native),
.meteo-panel__location-select :deep(.q-field__input),
.meteo-panel__location-select :deep(.q-icon) {
  color: inherit;
}

.meteo-panel__location-actions {
  flex-wrap: wrap;
}

.meteo-panel__recent-btn {
  background: rgba(255, 255, 255, 0.14);
  color: inherit;
  max-width: 120px;
}

.meteo-panel__recent-btn--active {
  background: rgba(255, 255, 255, 0.32);
  font-weight: 700;
}

.meteo-panel--colorize .meteo-panel__recent-btn {
  background: rgba(0, 0, 0, 0.16);
}

.meteo-panel--colorize .meteo-panel__recent-btn--active {
  background: rgba(0, 0, 0, 0.3);
}

.meteo-panel__now-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.85;
}

.meteo-panel__now-temp {
  font-size: 2.2rem;
  font-weight: 700;
  line-height: 1.05;
}

.meteo-panel__now-icon {
  opacity: 0.95;
}

.meteo-panel__now-stats {
  flex-wrap: wrap;
}

.meteo-panel__stat {
  font-size: 0.82rem;
  font-weight: 600;
}

.meteo-panel__stat--rain {
  font-weight: 700;
}

.meteo-panel__day-title {
  opacity: 0.9;
}

.meteo-panel__hours {
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
  overflow-x: auto;
  padding-bottom: 2px;
  -webkit-overflow-scrolling: touch;
}

.meteo-panel__hour {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 2px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  flex: 0 0 44px;
  min-width: 44px;
}

.meteo-panel--colorize .meteo-panel__hour {
  background: rgba(0, 0, 0, 0.12);
}

.meteo-panel__hour--eod {
  background: rgba(255, 255, 255, 0.22);
  flex: 0 0 48px;
  min-width: 48px;
}

.meteo-panel--colorize .meteo-panel__hour--eod {
  background: rgba(0, 0, 0, 0.22);
}

.meteo-panel__hour-time {
  font-size: 0.68rem;
  font-weight: 700;
  opacity: 0.85;
}

.meteo-panel__hour-temp {
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1.1;
}

.meteo-panel__hour-rain {
  font-size: 0.62rem;
  opacity: 0.8;
}

.meteo-panel__hour-icon {
  opacity: 0.92;
}
</style>
