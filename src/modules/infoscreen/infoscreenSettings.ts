import { loadCo21Settings, patchCo21Settings } from 'src/modules/storage/sync/roleProfileSettings';
import {
  defaultClockIntervalPreset,
  isInfoscreenClockIntervalPreset,
  type InfoscreenClockIntervalPreset,
} from './infoscreenClockSchedule';
import {
  defaultInfoscreenVariantId,
  normalizeInfoscreenVariantId,
  type InfoscreenVariantId,
} from './infoscreenVariants';

export const INFOSCREEN_CHANGED_EVENT = 'co21:infoscreen-changed';

/** After touch, user can interact for this long before idle/lock resumes. */
export const INFOSCREEN_INTERACTION_IDLE_MS = 60_000;

export const MIN_CLOCK_DISPLAY_SECONDS = 3;
export const MAX_CLOCK_DISPLAY_SECONDS = 300;
export const DEFAULT_CLOCK_DISPLAY_SECONDS = 10;

export type InfoscreenSettings = {
  enabled: boolean;
  variant: InfoscreenVariantId;
  /** When idle (wall-clock), block page interaction. */
  lockScreen: boolean;
  clockIntervalPreset: InfoscreenClockIntervalPreset;
  clockIntervalCustomMinutes: number;
  /** How long the full-screen clock stays visible (seconds). */
  clockDisplaySeconds: number;
};

export function clampClockDisplaySeconds(seconds: number): number {
  const n = Math.floor(seconds);
  if (!Number.isFinite(n)) return DEFAULT_CLOCK_DISPLAY_SECONDS;
  return Math.min(MAX_CLOCK_DISPLAY_SECONDS, Math.max(MIN_CLOCK_DISPLAY_SECONDS, n));
}

export function clockDisplayDurationMs(seconds: number): number {
  return clampClockDisplaySeconds(seconds) * 1000;
}

export function defaultInfoscreenSettings(): InfoscreenSettings {
  return {
    enabled: false,
    variant: defaultInfoscreenVariantId(),
    lockScreen: false,
    clockIntervalPreset: defaultClockIntervalPreset(),
    clockIntervalCustomMinutes: 15,
    clockDisplaySeconds: DEFAULT_CLOCK_DISPLAY_SECONDS,
  };
}

function dispatchInfoscreenChanged(detail: InfoscreenSettings): void {
  window.dispatchEvent(new CustomEvent(INFOSCREEN_CHANGED_EVENT, { detail }));
}

function parseSettings(data: Record<string, unknown>): InfoscreenSettings {
  const defaults = defaultInfoscreenSettings();
  return {
    enabled: typeof data.infoscreenEnabled === 'boolean' ? data.infoscreenEnabled : defaults.enabled,
    variant: normalizeInfoscreenVariantId(data.infoscreenVariant),
    lockScreen:
      typeof data.infoscreenLockScreen === 'boolean' ? data.infoscreenLockScreen : defaults.lockScreen,
    clockIntervalPreset: isInfoscreenClockIntervalPreset(data.infoscreenClockIntervalPreset)
      ? data.infoscreenClockIntervalPreset
      : defaults.clockIntervalPreset,
    clockIntervalCustomMinutes:
      typeof data.infoscreenClockIntervalCustomMinutes === 'number'
        ? data.infoscreenClockIntervalCustomMinutes
        : defaults.clockIntervalCustomMinutes,
    clockDisplaySeconds:
      typeof data.infoscreenClockDisplaySeconds === 'number'
        ? clampClockDisplaySeconds(data.infoscreenClockDisplaySeconds)
        : defaults.clockDisplaySeconds,
  };
}

export async function loadInfoscreenSettings(): Promise<InfoscreenSettings> {
  const data = await loadCo21Settings();
  return parseSettings(data);
}

async function patchInfoscreen(partial: Record<string, unknown>): Promise<boolean> {
  const data = await loadCo21Settings();
  const ok = await patchCo21Settings(partial);
  if (ok) {
    dispatchInfoscreenChanged(parseSettings({ ...data, ...partial }));
  }
  return ok;
}

export async function saveInfoscreenEnabled(enabled: boolean): Promise<boolean> {
  return patchInfoscreen({ infoscreenEnabled: enabled });
}

export async function saveInfoscreenVariant(variant: InfoscreenVariantId): Promise<boolean> {
  return patchInfoscreen({ infoscreenVariant: variant });
}

export async function saveInfoscreenLockScreen(lockScreen: boolean): Promise<boolean> {
  return patchInfoscreen({ infoscreenLockScreen: lockScreen });
}

export async function saveInfoscreenClockInterval(
  preset: InfoscreenClockIntervalPreset,
  customMinutes: number,
): Promise<boolean> {
  return patchInfoscreen({
    infoscreenClockIntervalPreset: preset,
    infoscreenClockIntervalCustomMinutes: customMinutes,
  });
}

export async function saveInfoscreenSettings(patch: Partial<InfoscreenSettings>): Promise<boolean> {
  const payload: Record<string, unknown> = {};
  if (patch.enabled !== undefined) payload.infoscreenEnabled = patch.enabled;
  if (patch.variant !== undefined) payload.infoscreenVariant = patch.variant;
  if (patch.lockScreen !== undefined) payload.infoscreenLockScreen = patch.lockScreen;
  if (patch.clockIntervalPreset !== undefined) {
    payload.infoscreenClockIntervalPreset = patch.clockIntervalPreset;
  }
  if (patch.clockIntervalCustomMinutes !== undefined) {
    payload.infoscreenClockIntervalCustomMinutes = patch.clockIntervalCustomMinutes;
  }
  if (patch.clockDisplaySeconds !== undefined) {
    payload.infoscreenClockDisplaySeconds = clampClockDisplaySeconds(patch.clockDisplaySeconds);
  }
  return patchInfoscreen(payload);
}
