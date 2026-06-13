/** Preset clock-tick intervals (minutes), or custom. */
export const INFOSCREEN_CLOCK_INTERVAL_PRESETS = ['5', '10', '15', '30', '60', 'custom'] as const;

export type InfoscreenClockIntervalPreset = (typeof INFOSCREEN_CLOCK_INTERVAL_PRESETS)[number];

export function isInfoscreenClockIntervalPreset(v: unknown): v is InfoscreenClockIntervalPreset {
  return typeof v === 'string' && (INFOSCREEN_CLOCK_INTERVAL_PRESETS as readonly string[]).includes(v);
}

export function defaultClockIntervalPreset(): InfoscreenClockIntervalPreset {
  return '15';
}

export function resolveClockIntervalMinutes(
  preset: InfoscreenClockIntervalPreset,
  customMinutes: number,
): number {
  if (preset === 'custom') {
    return Math.min(24 * 60, Math.max(1, Math.floor(customMinutes) || 15));
  }
  return Number(preset);
}

/** Next wall-clock tick aligned to interval from midnight (e.g. :00, :15, :30, :45 for 15 min). */
export function nextAlignedClockTime(from: Date, intervalMinutes: number): Date {
  const interval = Math.max(1, intervalMinutes);
  const totalMin =
    from.getHours() * 60 +
    from.getMinutes() +
    from.getSeconds() / 60 +
    from.getMilliseconds() / 60000;
  let nextTotal = Math.ceil(totalMin / interval) * interval;

  const out = new Date(from);
  if (nextTotal >= 24 * 60) {
    out.setDate(out.getDate() + 1);
    nextTotal -= 24 * 60;
  }
  out.setHours(Math.floor(nextTotal / 60), nextTotal % 60, 0, 0);
  return out;
}

export function msUntilNextClockTick(from: Date, intervalMinutes: number): number {
  const next = nextAlignedClockTime(from, intervalMinutes);
  return Math.max(0, next.getTime() - from.getTime());
}

/** True when `date` sits on an aligned interval boundary (e.g. :00, :15, :30 for 15 min). */
export function isAlignedClockMinute(date: Date, intervalMinutes: number): boolean {
  const interval = Math.max(1, Math.floor(intervalMinutes));
  return date.getMinutes() % interval === 0;
}

/** Stable key for the aligned slot containing `date` (dedupes splash triggers). */
export function alignedClockSlotKey(date: Date, intervalMinutes: number): string {
  const interval = Math.max(1, Math.floor(intervalMinutes));
  const day = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const slot = Math.floor((date.getHours() * 60 + date.getMinutes()) / interval);
  return `${day}:${slot}`;
}

export function clockSplashDurationMs(intervalMinutes: number): number {
  const intervalMs = intervalMinutes * 60 * 1000;
  return Math.min(12_000, Math.max(5_000, Math.floor(intervalMs * 0.2)));
}

export function formatClockSplashTime(date: Date): { hours: string; minutes: string } {
  const h = date.getHours();
  const m = date.getMinutes();
  return {
    hours: String(h).padStart(2, '0'),
    minutes: String(m).padStart(2, '0'),
  };
}
