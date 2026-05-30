import { loadCo21Settings, patchCo21Settings } from 'src/modules/storage/sync/roleProfileSettings';
import type { MeteoLocation } from './meteoService';

export const METEO_SYNC_CHANGED_EVENT = 'co21:meteo-sync-changed';
export const METEO_LOCATION_CHANGED_EVENT = 'co21:meteo-location-changed';

const METEO_RECENT_MAX = 10;

export async function loadMeteoSyncEnabled(): Promise<boolean> {
  const data = await loadCo21Settings();
  if (typeof data.meteoSyncEnabled === 'boolean') return data.meteoSyncEnabled;
  return false;
}

export async function saveMeteoSyncEnabled(enabled: boolean): Promise<boolean> {
  const ok = await patchCo21Settings({ meteoSyncEnabled: enabled });
  if (ok) {
    window.dispatchEvent(
      new CustomEvent(METEO_SYNC_CHANGED_EVENT, { detail: { enabled } }),
    );
  }
  return ok;
}

function parseMeteoLocation(raw: unknown): MeteoLocation | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const latitude = Number(o.latitude);
  const longitude = Number(o.longitude);
  const name = typeof o.name === 'string' ? o.name.trim() : '';
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !name) return null;
  return { latitude, longitude, name };
}

export function meteoLocationsMatch(a: MeteoLocation, b: MeteoLocation): boolean {
  return (
    Math.abs(a.latitude - b.latitude) < 0.05 &&
    Math.abs(a.longitude - b.longitude) < 0.05
  );
}

export async function loadMeteoLocation(): Promise<MeteoLocation | null> {
  const data = await loadCo21Settings();
  return parseMeteoLocation(data.meteoLocation);
}

export async function loadMeteoRecentLocations(): Promise<MeteoLocation[]> {
  const data = await loadCo21Settings();
  const raw = data.meteoRecentLocations;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => parseMeteoLocation(item))
    .filter((item): item is MeteoLocation => item !== null)
    .slice(0, METEO_RECENT_MAX);
}

export async function saveMeteoLocationSelection(location: MeteoLocation): Promise<boolean> {
  const recent = await loadMeteoRecentLocations();
  const next = [
    location,
    ...recent.filter((item) => !meteoLocationsMatch(item, location)),
  ].slice(0, METEO_RECENT_MAX);
  const ok = await patchCo21Settings({
    meteoLocation: location,
    meteoRecentLocations: next,
  });
  if (ok) {
    window.dispatchEvent(
      new CustomEvent(METEO_LOCATION_CHANGED_EVENT, { detail: { location } }),
    );
  }
  return ok;
}
