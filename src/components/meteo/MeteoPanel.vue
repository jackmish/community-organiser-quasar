<template>
  <div
    v-if="meteoEnabled"
    class="meteo-panel q-px-sm q-pb-sm"
    :class="{ 'meteo-panel--colorize': panelTheme.colorize }"
    :style="panelStyle"
  >
    <q-btn
      flat
      dense
      round
      icon="refresh"
      class="meteo-panel__refresh-btn"
      :style="{ color: panelTheme.fg }"
      :loading="loading"
      :aria-label="$text('meteo.refresh')"
      @click="void loadForecast(true)"
    />
    <q-btn
      flat
      dense
      round
      icon="my_location"
      class="meteo-panel__gps-btn"
      :style="{ color: panelTheme.fg }"
      :loading="gpsLoading"
      :disable="locationSaving || loading"
      :aria-label="$text('meteo.location_gps')"
      @click="void useDeviceLocation()"
    >
      <q-tooltip>{{ $text('meteo.location_gps') }}</q-tooltip>
    </q-btn>

    <div v-if="loading && !snapshot" class="text-caption meteo-panel__muted q-mt-sm">
      <q-spinner size="14px" class="q-mr-xs" />
      {{ $text('meteo.loading') }}
    </div>
    <div v-else-if="error && !snapshot" class="text-caption meteo-panel__muted q-mt-sm">
      {{ $text('meteo.error') }}
    </div>

    <template v-else-if="snapshot">
      <div class="row q-col-gutter-md meteo-panel__now-row">
        <div class="col-12 col-sm-auto meteo-panel__now">
          <div class="row items-center no-wrap meteo-panel__now-main" style="gap: 12px">
            <q-icon :name="weatherIcon" size="42px" class="meteo-panel__now-icon" />
            <div>
              <div class="meteo-panel__now-label">{{ $text('meteo.now') }}</div>
              <div class="meteo-panel__now-temp">{{ formatTemp(snapshot.current.temperature) }}</div>
              <div class="text-body2 meteo-panel__muted">{{ weatherLabel }}</div>
            </div>
          </div>
          <div class="row q-mt-sm meteo-panel__now-stats" style="gap: 14px">
            <span class="meteo-panel__stat meteo-panel__stat--rain">
              {{ $text('meteo.rain_chance').replace('{value}', String(snapshot.current.rainChance)) }}
            </span>
          </div>
        </div>

        <div class="col-12 col-sm-auto meteo-panel__location-col" :style="locationColThemeStyle">
          <q-select
            :key="locationSelectThemeKey"
            v-model="selectedLocation"
            class="use-default meteo-panel__location-select"
            :class="{ 'meteo-panel__location-select--has-value': !!selectedLocation }"
            :style="locationFieldStyle"
            :options="cityOptions"
            :option-label="locationSelectLabel"
            use-input
            fill-input
            hide-selected
            input-debounce="400"
            outlined
            hide-bottom-space
            behavior="menu"
            :label="locationSelectFieldLabel"
            :loading="searchLoading"
            :disable="locationSaving"
            :input-style="locationFieldInputStyle"
            popup-content-class="use-default co21-themed-menu"
            :popup-content-style="locationPopupStyle"
            :options-dark="false"
            @filter="filterCities"
            @update:model-value="onLocationPicked"
            @popup-show="onLocationPopupShow"
          >
            <template #option="scope">
              <q-item v-bind="scope.itemProps" class="co21-menu-option">
                <q-item-section>{{ scope.opt.name }}</q-item-section>
              </q-item>
            </template>
            <template #no-option>
              <q-item class="co21-menu-option">
                <q-item-section class="co21-menu-option-hint">
                  {{ citySearchHint }}
                </q-item-section>
              </q-item>
            </template>
          </q-select>

          <div class="meteo-panel__location-actions">
            <div class="meteo-panel__recent-scroll meteo-panel__nice-scroll">
              <div class="meteo-panel__recent-list">
                <q-btn
                  v-for="loc in recentLocations"
                  :key="locationKey(loc)"
                  no-caps
                  unelevated
                  class="co21-field-btn meteo-panel__recent-btn"
                  :class="{ 'co21-field-btn--active': isActiveLocation(loc) }"
                  :style="locationFieldStyle"
                  :label="locationCityName(loc.name)"
                  :disable="locationSaving || loading"
                  @click="void applyLocation(loc)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-for="day in snapshot.days" :key="day.date" class="meteo-panel__day">
        <div class="text-caption text-weight-bold meteo-panel__day-title">
          {{ dayLabel(day) }}
        </div>
        <div class="meteo-panel__hours meteo-panel__nice-scroll meteo-panel__nice-scroll--horizontal">
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
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { $text } from 'src/modules/lang';
import { formatAppWeekday } from 'src/modules/lang/dateFormat';
import CC from 'src/CCAccess';
import {
  buildCo21SurfaceThemeInputFromGroup,
  getCo21FieldCssVariables,
  getCo21MenuPopupStyleInline,
  pinCo21MenuPopupThemeWhenReady,
  resolveCo21FieldTheme,
  resolveCo21MenuTheme,
  getCo21SurfaceBackgroundStyle,
} from 'src/components/theme';
import {
  readGroupBackgroundFields,
  isGroupBackgroundColorizeActive,
} from 'src/modules/group/utils/groupBackground';
import { getContrastColor } from 'src/utils/colorUtils';
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
  locationCityName,
  type MeteoDayForecast,
  type MeteoLocation,
  type MeteoSnapshot,
} from 'src/modules/time/meteoService';

const METEO_DEFAULT_BG = 'rgba(2, 119, 189, 0.82)';
const METEO_DEFAULT_HEX = '#0277bd';
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

/** Bump when group list / active group / color fields change (deep). */
const groupThemeRevision = ref(0);

watch(
  () => [CC.group.list.all.value, CC.group.active.activeGroup.value] as const,
  () => {
    groupThemeRevision.value += 1;
  },
  { deep: true },
);

function resolveActiveGroupRecord(): Record<string, unknown> | null {
  try {
    const gid = CC.group.active.activeGroup.value?.value ?? null;
    if (!gid) return null;
    const list = CC.group.list.all.value ?? [];
    const g = list.find((x) => String(x?.id) === String(gid));
    return g && typeof g === 'object' ? (g as unknown as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const panelTheme = computed(() => {
  void groupThemeRevision.value;
  const group = resolveActiveGroupRecord();
  const colorize = isGroupBackgroundColorizeActive(group);
  const { color, textColor } = readGroupBackgroundFields(group);
  const fg = textColor || getContrastColor(color);
  return { colorize, color, fg };
});

const surfaceThemeInput = computed(() => {
  void groupThemeRevision.value;
  const fromGroup = buildCo21SurfaceThemeInputFromGroup(resolveActiveGroupRecord());
  if (fromGroup) return fromGroup;
  return {
    baseHex: METEO_DEFAULT_HEX,
    textHex: METEO_DEFAULT_FG,
    panelHex: METEO_DEFAULT_HEX,
  };
});

const panelStyle = computed(() => {
  const input = surfaceThemeInput.value;
  if (!panelTheme.value.colorize) {
    return {
      backgroundColor: METEO_DEFAULT_BG,
      '--meteo-panel-fg': METEO_DEFAULT_FG,
    };
  }
  const { color, fg } = panelTheme.value;
  const { backgroundColor } = getCo21SurfaceBackgroundStyle(input);
  return {
    backgroundColor,
    '--meteo-panel-fg': fg,
  };
});

const locationColThemeStyle = computed(() => {
  const { fieldFg } = resolveCo21FieldTheme(surfaceThemeInput.value);
  return { color: fieldFg };
});

const locationFieldStyle = computed(() => {
  const { fieldBg, fieldFg } = resolveCo21FieldTheme(surfaceThemeInput.value);
  return {
    ...getCo21FieldCssVariables(surfaceThemeInput.value),
    color: fieldFg,
    backgroundColor: 'transparent',
    '--co21-field-fg': fieldFg,
    '--co21-field-bg': fieldBg,
  };
});

const locationFieldInputStyle = computed(() => {
  const fg = locationFieldStyle.value['--co21-field-fg'] ?? '#000000';
  const hasValue = !!selectedLocation.value;
  return {
    color: fg,
    WebkitTextFillColor: fg,
    caretColor: fg,
    fontSize: hasValue ? '2.2rem' : '1.1rem',
    fontWeight: '700',
    lineHeight: hasValue ? '1.05' : '1.25',
  };
});

const locationPopupStyle = computed(() =>
  getCo21MenuPopupStyleInline(surfaceThemeInput.value),
);

const locationSelectThemeKey = computed(() => {
  void groupThemeRevision.value;
  const { fieldBg } = resolveCo21FieldTheme(surfaceThemeInput.value);
  const { menuBg } = resolveCo21MenuTheme(surfaceThemeInput.value);
  return `${fieldBg}|${menuBg}`;
});

function onLocationPopupShow() {
  pinCo21MenuPopupThemeWhenReady(surfaceThemeInput.value);
}

watch(surfaceThemeInput, (input) => {
  pinCo21MenuPopupThemeWhenReady(input);
}, { deep: true });

function locationSelectLabel(opt: MeteoLocation): string {
  return locationCityName(opt.name);
}

const locationSelectFieldLabel = computed(() =>
  selectedLocation.value ? undefined : $text('meteo.location_search'),
);

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
      pinCo21MenuPopupThemeWhenReady(surfaceThemeInput.value);
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
  position: relative;
  --meteo-panel-inset: 24px;
  padding-top: var(--meteo-panel-inset);
  --meteo-scroll-thumb: rgba(255, 255, 255, 0.32);
  --meteo-scroll-thumb-hover: rgba(255, 255, 255, 0.5);
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 0 0 8px 8px;
  color: var(--meteo-panel-fg, #ffffff);
}

.meteo-panel--colorize {
  --meteo-scroll-thumb: rgba(0, 0, 0, 0.24);
  --meteo-scroll-thumb-hover: rgba(0, 0, 0, 0.38);
}

.meteo-panel__refresh-btn {
  position: absolute;
  top: 4px;
  left: 4px;
  z-index: 1;
}

.meteo-panel__gps-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 1;
}

.meteo-panel__muted {
  opacity: 0.82;
}

.meteo-panel__now-row {
  align-items: flex-start;
  justify-content: center;
}

.meteo-panel__now {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.meteo-panel__now-main {
  justify-content: center;
}

.meteo-panel__now-stats {
  justify-content: center;
}

.meteo-panel__location-col {
  min-width: 0;
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  align-items: center;
  /* Field/menu use resolveCo21FieldTheme — not group textColor from the panel. */
  color: unset;
}

.meteo-panel__location-select {
  width: 100%;
  min-width: min(100%, 280px);
}

.meteo-panel__location-select :deep(.q-field__control) {
  min-height: 44px;
  height: auto !important;
}

.meteo-panel__location-select :deep(.q-field__append) {
  align-self: center;
}

.meteo-panel__location-select :deep(.q-field__native),
.meteo-panel__location-select :deep(input),
.meteo-panel__location-select :deep(.q-field__input),
.meteo-panel__location-select :deep(.q-select__input) {
  font-size: 1.1rem;
  font-weight: 600;
  line-height: 1.25;
  color: var(--co21-field-fg) !important;
  -webkit-text-fill-color: var(--co21-field-fg) !important;
  caret-color: var(--co21-field-fg) !important;
}

.meteo-panel__location-select :deep(.q-field__label) {
  font-size: 1rem;
}

.meteo-panel__location-select :deep(.q-field__marginal .q-icon) {
  font-size: 1.35rem;
}

.meteo-panel__now-temp {
  font-size: 3.5rem;
  font-weight: 700;
  line-height: 1.05;
}

.meteo-panel__location-select--has-value :deep(.q-field__native),
.meteo-panel__location-select--has-value :deep(input),
.meteo-panel__location-select--has-value :deep(.q-field__input),
.meteo-panel__location-select--has-value :deep(.q-select__input) {
  font-size: 2.2rem;
  font-weight: 700;
  line-height: 1.05;
  color: var(--co21-field-fg) !important;
  -webkit-text-fill-color: var(--co21-field-fg) !important;
  caret-color: var(--co21-field-fg) !important;
}

/* Quasar q-select input uses height:0 + line-height:24px — override or large text clips. */
.meteo-panel__location-select--has-value :deep(.q-field__control) {
  min-height: calc(2.2rem * 1.05 + 12px);
  padding: 6px 12px;
  overflow: visible !important;
}

.meteo-panel__location-select--has-value :deep(.q-field__control-container) {
  height: auto !important;
  min-height: calc(2.2rem * 1.05);
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  overflow: visible !important;
}

.meteo-panel__location-select--has-value :deep(.q-field__input),
.meteo-panel__location-select--has-value :deep(.q-select__input) {
  height: auto !important;
  min-height: calc(2.2rem * 1.05) !important;
  line-height: 1.05 !important;
  padding: 0 !important;
  overflow: visible !important;
}

.meteo-panel__location-select--has-value :deep(.q-field__marginal) {
  height: auto !important;
  min-height: calc(2.2rem * 1.05 + 12px);
}

.meteo-panel__location-select--has-value :deep(.q-field__marginal .q-icon) {
  font-size: 1.75rem;
}

.meteo-panel__location-actions {
  width: 100%;
  margin-top: 4px;
}

.meteo-panel__recent-scroll {
  width: 100%;
  /* 2 button rows + row gap + vertical padding (border-box) */
  max-height: calc(42px * 2 + 6px + 10px);
  overflow-y: auto;
  overflow-x: hidden;
  padding: 5px 4px;
  box-sizing: border-box;
}

.meteo-panel__recent-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
}

.meteo-panel__nice-scroll {
  scrollbar-width: thin;
  scrollbar-color: var(--meteo-scroll-thumb) transparent;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

.meteo-panel__nice-scroll::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.meteo-panel__nice-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.meteo-panel__nice-scroll::-webkit-scrollbar-thumb {
  background: var(--meteo-scroll-thumb);
  border-radius: 999px;
}

.meteo-panel__nice-scroll::-webkit-scrollbar-thumb:hover {
  background: var(--meteo-scroll-thumb-hover);
}

.meteo-panel__nice-scroll--horizontal {
  scroll-behavior: smooth;
  scroll-snap-type: x proximity;
  padding-bottom: 6px;
}

.meteo-panel__nice-scroll--horizontal .meteo-panel__hour {
  scroll-snap-align: start;
}

.meteo-panel__recent-btn.q-btn {
  min-height: 40px;
  padding: 0 14px;
  font-size: 1.05rem;
  font-weight: 600;
  line-height: 1.2;
}

.meteo-panel__recent-btn.q-btn :deep(.q-btn__content) {
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.meteo-panel__now-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.85;
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
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.2;
}

.meteo-panel__day {
  margin-top: 8px;
}

.meteo-panel__day + .meteo-panel__day {
  margin-top: 10px;
}

.meteo-panel__day-title {
  opacity: 0.9;
  margin-bottom: 2px;
  line-height: 1.2;
}

.meteo-panel__hours {
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
  overflow-x: auto;
  overflow-y: hidden;
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
