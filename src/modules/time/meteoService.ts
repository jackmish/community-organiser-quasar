import logger from 'src/utils/logger';
import { getCountryCode, getLanguage } from 'src/modules/lang';
import { loadMeteoSyncEnabled, loadMeteoLocation } from './meteoSyncSettings';

export const OPEN_METEO_FORECAST_API = 'https://api.open-meteo.com/v1/forecast';
export const OPEN_METEO_GEOCODING_API = 'https://geocoding-api.open-meteo.com/v1';

export interface MeteoLocation {
  latitude: number;
  longitude: number;
  name: string;
}

export interface MeteoCurrent {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  rainChance: number;
}

export interface MeteoHourSlot {
  time: string;
  hour: number;
  temperature: number;
  rainChance: number;
  weatherCode: number;
}

export interface MeteoDayForecast {
  date: string;
  dayIndex: number;
  hours: MeteoHourSlot[];
}

export interface MeteoSnapshot {
  location: MeteoLocation;
  current: MeteoCurrent;
  days: MeteoDayForecast[];
  fetchedAt: number;
}

interface MeteoCachePayload {
  version?: number;
  snapshot: MeteoSnapshot;
}

const METEO_CACHE_VERSION = 5;

const CACHE_TTL_MS = 30 * 60 * 1000;
const FORECAST_DAY_COUNT = 3;
export const FORECAST_HOUR_FROM = 7;
/** Default visible end hour for future days (today uses a sliding window). */
export const FORECAST_DISPLAY_HOUR_TO = 19;
/** Last regular hour slot stored from the API (supports evening sliding window). */
export const FORECAST_HOUR_TO = 23;
const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

const COUNTRY_DEFAULTS: Record<string, MeteoLocation> = {
  PL: { latitude: 52.2297, longitude: 21.0122, name: 'Warsaw' },
  US: { latitude: 40.7128, longitude: -74.006, name: 'New York' },
  GB: { latitude: 51.5074, longitude: -0.1278, name: 'London' },
  DE: { latitude: 52.52, longitude: 13.405, name: 'Berlin' },
  FR: { latitude: 48.8566, longitude: 2.3522, name: 'Paris' },
  ES: { latitude: 40.4168, longitude: -3.7038, name: 'Madrid' },
  IT: { latitude: 41.9028, longitude: 12.4964, name: 'Rome' },
  CZ: { latitude: 50.0755, longitude: 14.4378, name: 'Prague' },
  SK: { latitude: 48.1486, longitude: 17.1077, name: 'Bratislava' },
  UA: { latitude: 50.4501, longitude: 30.5234, name: 'Kyiv' },
};

const DEFAULT_METEO_LOCATION: MeteoLocation = {
  latitude: 40.7128,
  longitude: -74.006,
  name: 'New York',
};

function xhrGetJson<T>(url: string, timeoutMs = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.timeout = timeoutMs;
    xhr.open('GET', url);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as T);
        } catch {
          reject(new Error('Failed to parse JSON'));
        }
      } else {
        reject(new Error(`HTTP error! status: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.ontimeout = () => reject(new Error('Request timeout'));
    xhr.send();
  });
}

function countryFallbackLocation(): MeteoLocation {
  const code = getCountryCode().toUpperCase();
  return COUNTRY_DEFAULTS[code] ?? DEFAULT_METEO_LOCATION;
}

async function getCacheFilePath(): Promise<string | null> {
  if (!isElectron) return null;
  const appDataPath = await (window as any).electronAPI.getAppDataPath();
  return (window as any).electronAPI.joinPath(appDataPath, 'meteo', 'meteo_cache.json');
}

async function loadMeteoCache(): Promise<MeteoSnapshot | null> {
  try {
    let payload: MeteoCachePayload | null = null;
    if (isElectron) {
      const filePath = await getCacheFilePath();
      if (!filePath) return null;
      const exists = await (window as any).electronAPI.fileExists(filePath);
      if (!exists) return null;
      payload = (await (window as any).electronAPI.readJsonFile(filePath)) as MeteoCachePayload;
    } else {
      const raw = localStorage.getItem('meteo_cache');
      if (!raw) return null;
      payload = JSON.parse(raw) as MeteoCachePayload;
    }
    if (!payload?.snapshot) return null;
    if (payload.version !== METEO_CACHE_VERSION) return null;
    return payload.snapshot;
  } catch (error) {
    logger.error('Failed to load meteo cache:', error);
    return null;
  }
}

async function saveMeteoCache(snapshot: MeteoSnapshot): Promise<void> {
  try {
    const payload: MeteoCachePayload = { version: METEO_CACHE_VERSION, snapshot };
    if (isElectron) {
      const filePath = await getCacheFilePath();
      if (!filePath) return;
      const dirPath = (window as any).electronAPI.joinPath(
        await (window as any).electronAPI.getAppDataPath(),
        'meteo',
      );
      await (window as any).electronAPI.ensureDir(dirPath);
      const safe = JSON.parse(JSON.stringify(payload));
      await (window as any).electronAPI.writeJsonFile(filePath, safe);
    } else {
      localStorage.setItem('meteo_cache', JSON.stringify(payload));
    }
  } catch (error) {
    logger.error('Failed to save meteo cache:', error);
  }
}

function isCacheFresh(snapshot: MeteoSnapshot | null, location: MeteoLocation | null): boolean {
  if (!snapshot?.fetchedAt || !snapshot.days?.length) return false;
  if (snapshot.days.length < FORECAST_DAY_COUNT) return false;
  if (!snapshot.days.every(dayHasHour24)) return false;
  if (snapshotNeedsEveningHours(snapshot)) return false;
  if (location && snapshot.location) {
    const latOk = Math.abs(snapshot.location.latitude - location.latitude) < 0.05;
    const lonOk = Math.abs(snapshot.location.longitude - location.longitude) < 0.05;
    if (!latOk || !lonOk) return false;
  }
  return Date.now() - snapshot.fetchedAt < CACHE_TTL_MS;
}

function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseHourFromIso(iso: string): number {
  const match = /T(\d{2})/.exec(iso);
  return match ? Number(match[1]) : 0;
}

function parseDateFromIso(iso: string): string {
  return iso.slice(0, 10);
}

function findHourlyIndex(times: string[], dateKey: string, hour: number): number {
  return times.findIndex(
    (t) => parseDateFromIso(t) === dateKey && parseHourFromIso(t) === hour,
  );
}

function nextDateKey(date: string): string {
  const parts = date.split('-').map(Number);
  const [year, month, day] = parts;
  if (parts.length !== 3 || !year || !month || !day) return date;
  return localDateKey(new Date(year, month - 1, day + 1));
}

function buildHourSlot(
  time: string,
  hour: number,
  index: number,
  temperatures: Array<number | null | undefined>,
  rainChances: Array<number | null | undefined>,
  weatherCodes: Array<number | null | undefined>,
): MeteoHourSlot {
  return {
    time,
    hour,
    temperature: temperatures[index] ?? 0,
    rainChance: rainChances[index] ?? 0,
    weatherCode: weatherCodes[index] ?? 0,
  };
}

function hour24SlotForDay(
  date: string,
  times: string[],
  temperatures: Array<number | null | undefined>,
  rainChances: Array<number | null | undefined>,
  weatherCodes: Array<number | null | undefined>,
): MeteoHourSlot | null {
  const nextDay = nextDateKey(date);
  let idx = findHourlyIndex(times, nextDay, 0);
  if (idx < 0) {
    idx = findHourlyIndex(times, date, 23);
  }
  if (idx < 0) return null;
  const time = times[idx];
  if (!time) return null;
  return buildHourSlot(time, 24, idx, temperatures, rainChances, weatherCodes);
}

function dayHasHour24(day: MeteoDayForecast): boolean {
  return day.hours.some((h) => h.hour === 24);
}

function dayHasEveningHours(day: MeteoDayForecast): boolean {
  return day.hours.some((h) => h.hour >= 20 && h.hour <= FORECAST_HOUR_TO);
}

function snapshotNeedsEveningHours(snapshot: MeteoSnapshot): boolean {
  const nowHour = new Date().getHours();
  if (nowHour < FORECAST_DISPLAY_HOUR_TO) return false;
  const today = snapshot.days[0];
  if (!today) return true;
  return !dayHasEveningHours(today);
}

function rainChanceForNow(
  times: string[],
  rainChances: Array<number | null | undefined>,
): number {
  const now = new Date();
  const todayKey = localDateKey(now);
  const hour = now.getHours();
  const exact = `${todayKey}T${String(hour).padStart(2, '0')}:00`;
  let idx = times.indexOf(exact);
  if (idx < 0) {
    idx = times.findIndex((t) => t.startsWith(todayKey) && parseHourFromIso(t) === hour);
  }
  if (idx < 0) {
    idx = times.findIndex((t) => t.startsWith(todayKey));
  }
  if (idx < 0) return 0;
  return rainChances[idx] ?? 0;
}

function buildDayForecasts(
  times: string[],
  temperatures: Array<number | null | undefined>,
  rainChances: Array<number | null | undefined>,
  weatherCodes: Array<number | null | undefined>,
): MeteoDayForecast[] {
  const slotsByDate = new Map<string, MeteoHourSlot[]>();

  for (let i = 0; i < times.length; i++) {
    const time = times[i];
    if (!time) continue;
    const hour = parseHourFromIso(time);
    if (hour < FORECAST_HOUR_FROM || hour > FORECAST_HOUR_TO) continue;
    const date = time.slice(0, 10);
    const slot = buildHourSlot(time, hour, i, temperatures, rainChances, weatherCodes);
    const list = slotsByDate.get(date) ?? [];
    list.push(slot);
    slotsByDate.set(date, list);
  }

  const todayKey = localDateKey(new Date());
  const sortedDates = [...slotsByDate.keys()].sort().filter((d) => d >= todayKey);
  return sortedDates.slice(0, FORECAST_DAY_COUNT).map((date, dayIndex) => {
    const hours = (slotsByDate.get(date) ?? []).sort((a, b) => a.hour - b.hour);
    const hour24 = hour24SlotForDay(date, times, temperatures, rainChances, weatherCodes);
    if (hour24 && !hours.some((h) => h.hour === 24)) {
      hours.push(hour24);
    }
    return { date, dayIndex, hours };
  });
}

async function resolveLocationName(latitude: number, longitude: number): Promise<string> {
  try {
    const lang = getLanguage();
    const url =
      `${OPEN_METEO_GEOCODING_API}/reverse?latitude=${latitude}` +
      `&longitude=${longitude}&language=${encodeURIComponent(lang)}&count=1`;
    const data = await xhrGetJson<{ results?: Array<{ name?: string; admin1?: string }> }>(url);
    const hit = data.results?.[0];
    if (!hit?.name) return `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
    return hit.admin1 ? `${hit.name}, ${hit.admin1}` : hit.name;
  } catch {
    return `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
  }
}

async function resolveDeviceLocation(): Promise<MeteoLocation | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        void resolveLocationName(latitude, longitude).then((name) => {
          resolve({ latitude, longitude, name });
        });
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 15 * 60 * 1000 },
    );
  });
}

async function resolveLocation(): Promise<MeteoLocation> {
  const saved = await loadMeteoLocation();
  if (saved) return saved;
  const device = await resolveDeviceLocation();
  if (device) return device;
  return countryFallbackLocation();
}

export async function resolveDeviceMeteoLocation(): Promise<MeteoLocation | null> {
  return resolveDeviceLocation();
}

function formatGeocodingLabel(hit: {
  name: string;
  admin1?: string;
  country?: string;
}): string {
  if (hit.admin1) return `${hit.name}, ${hit.admin1}`;
  if (hit.country) return `${hit.name}, ${hit.country}`;
  return hit.name;
}

/** City only — strips county/province/country suffix from geocoding labels. */
export function locationCityName(name: string): string {
  const trimmed = name.trim();
  const comma = trimmed.indexOf(',');
  return comma >= 0 ? trimmed.slice(0, comma).trim() : trimmed;
}

export async function searchMeteoCities(query: string): Promise<MeteoLocation[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const lang = getLanguage();
    const url =
      `${OPEN_METEO_GEOCODING_API}/search?name=${encodeURIComponent(q)}` +
      `&count=8&language=${encodeURIComponent(lang)}`;
    const data = await xhrGetJson<{
      results?: Array<{
        name: string;
        latitude: number;
        longitude: number;
        admin1?: string;
        country?: string;
      }>;
    }>(url);
    return (data.results ?? []).map((hit) => ({
      latitude: hit.latitude,
      longitude: hit.longitude,
      name: formatGeocodingLabel(hit),
    }));
  } catch (error) {
    logger.warn('Meteo city search failed:', error);
    return [];
  }
}

async function fetchForecast(location: MeteoLocation): Promise<MeteoSnapshot> {
  const url =
    `${OPEN_METEO_FORECAST_API}?latitude=${location.latitude}` +
    `&longitude=${location.longitude}` +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m' +
    '&hourly=temperature_2m,precipitation_probability,weather_code' +
    `&forecast_days=${FORECAST_DAY_COUNT + 1}` +
    '&wind_speed_unit=ms&timezone=auto';
  const data = await xhrGetJson<{
    current?: {
      temperature_2m?: number;
      apparent_temperature?: number;
      relative_humidity_2m?: number;
      weather_code?: number;
      wind_speed_10m?: number;
    };
    hourly?: {
      time?: string[];
      temperature_2m?: Array<number | null>;
      precipitation_probability?: Array<number | null>;
      weather_code?: Array<number | null>;
    };
  }>(url);

  const current = data.current;
  const hourly = data.hourly;
  if (!current || typeof current.temperature_2m !== 'number' || !hourly?.time?.length) {
    throw new Error('Invalid forecast response');
  }

  const times = hourly.time;
  const rainChances = hourly.precipitation_probability ?? [];
  const days = buildDayForecasts(
    times,
    hourly.temperature_2m ?? [],
    rainChances,
    hourly.weather_code ?? [],
  );

  return {
    location,
    current: {
      temperature: current.temperature_2m,
      apparentTemperature: current.apparent_temperature ?? current.temperature_2m,
      humidity: current.relative_humidity_2m ?? 0,
      windSpeed: current.wind_speed_10m ?? 0,
      weatherCode: current.weather_code ?? 0,
      rainChance: rainChanceForNow(times, rainChances),
    },
    days,
    fetchedAt: Date.now(),
  };
}

export function describeWeatherCode(code: number): { labelKey: string; icon: string } {
  if (code === 0) return { labelKey: 'meteo.weather.clear', icon: 'wb_sunny' };
  if (code <= 3) return { labelKey: 'meteo.weather.cloudy', icon: 'cloud' };
  if (code <= 48) return { labelKey: 'meteo.weather.fog', icon: 'foggy' };
  if (code <= 57) return { labelKey: 'meteo.weather.drizzle', icon: 'grain' };
  if (code <= 67) return { labelKey: 'meteo.weather.rain', icon: 'water_drop' };
  if (code <= 77) return { labelKey: 'meteo.weather.snow', icon: 'ac_unit' };
  if (code <= 82) return { labelKey: 'meteo.weather.showers', icon: 'umbrella' };
  if (code <= 86) return { labelKey: 'meteo.weather.snow_showers', icon: 'ac_unit' };
  if (code <= 99) return { labelKey: 'meteo.weather.thunderstorm', icon: 'thunderstorm' };
  return { labelKey: 'meteo.weather.unknown', icon: 'help_outline' };
}

export function meteoSnapshotNeedsEveningRefetch(snapshot: MeteoSnapshot | null): boolean {
  if (!snapshot) return false;
  return snapshotNeedsEveningHours(snapshot);
}

export async function refreshMeteoData(force = false): Promise<MeteoSnapshot | null> {
  const enabled = await loadMeteoSyncEnabled();
  if (!enabled) return null;

  const location = await resolveLocation();

  if (!force) {
    const cached = await loadMeteoCache();
    if (isCacheFresh(cached, location)) return cached;
  }

  try {
    const snapshot = await fetchForecast(location);
    await saveMeteoCache(snapshot);
    return snapshot;
  } catch (error) {
    logger.warn('Failed to fetch meteo forecast:', error);
    const cached = await loadMeteoCache();
    if (cached && isCacheFresh(cached, location)) return cached;
    return cached;
  }
}
