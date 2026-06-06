import { loadCo21Settings, patchCo21Settings } from 'src/modules/storage/sync/roleProfileSettings';
import { normalizeAppViewMode, type AppViewMode } from './mediaMode';

export const MEDIA_VIEW_MODE_CHANGED_EVENT = 'co21:media-view-mode-changed';

export type MediaViewModeByGroup = Record<string, AppViewMode>;

function parseModeMap(data: Record<string, unknown>): MediaViewModeByGroup {
  const raw = data.mediaViewModeByGroup;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: MediaViewModeByGroup = {};
  for (const [groupId, mode] of Object.entries(raw as Record<string, unknown>)) {
    if (!groupId) continue;
    out[groupId] = normalizeAppViewMode(mode);
  }
  return out;
}

function dispatchChanged(map: MediaViewModeByGroup): void {
  window.dispatchEvent(new CustomEvent(MEDIA_VIEW_MODE_CHANGED_EVENT, { detail: map }));
}

export async function loadMediaViewModeMap(): Promise<MediaViewModeByGroup> {
  const data = await loadCo21Settings();
  return parseModeMap(data);
}

export async function loadMediaViewModeForGroup(groupId: string): Promise<AppViewMode> {
  if (!groupId) return 'calendar';
  const map = await loadMediaViewModeMap();
  return normalizeAppViewMode(map[groupId]);
}

export async function saveMediaViewModeForGroup(
  groupId: string,
  mode: AppViewMode,
): Promise<boolean> {
  if (!groupId) return false;
  const data = await loadCo21Settings();
  const map = parseModeMap(data);
  map[groupId] = normalizeAppViewMode(mode);
  const ok = await patchCo21Settings({ mediaViewModeByGroup: map });
  if (ok) dispatchChanged(map);
  return ok;
}
