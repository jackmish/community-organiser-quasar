import { loadCo21Settings, patchCo21Settings } from 'src/modules/storage/sync/roleProfileSettings';
import {
  CLOCK_TIMER_ALARM_MELODY_IDS,
  type ClockTimerAlarmMelodyId,
} from './clockTimerMelodies';

export const CLOCK_TIMER_MELODY_CHANGED_EVENT = 'co21:clock-timer-melody-changed';

const SETTINGS_KEY = 'clockTimerAlarmMelody';

let activeMelodyId: ClockTimerAlarmMelodyId = 'classic';

function isMelodyId(value: unknown): value is ClockTimerAlarmMelodyId {
  return typeof value === 'string' && (CLOCK_TIMER_ALARM_MELODY_IDS as readonly string[]).includes(value);
}

export function getClockTimerAlarmMelodyId(): ClockTimerAlarmMelodyId {
  return activeMelodyId;
}

export async function loadClockTimerAlarmMelody(): Promise<ClockTimerAlarmMelodyId> {
  const data = await loadCo21Settings();
  const stored = data[SETTINGS_KEY];
  if (isMelodyId(stored)) {
    activeMelodyId = stored;
  }
  return activeMelodyId;
}

export async function saveClockTimerAlarmMelody(id: ClockTimerAlarmMelodyId): Promise<boolean> {
  activeMelodyId = id;
  const ok = await patchCo21Settings({ [SETTINGS_KEY]: id });
  if (ok) {
    window.dispatchEvent(
      new CustomEvent(CLOCK_TIMER_MELODY_CHANGED_EVENT, { detail: { melodyId: id } }),
    );
  }
  return ok;
}
