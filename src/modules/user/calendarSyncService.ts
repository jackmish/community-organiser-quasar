/**
 * Google Calendar sync service.
 *
 * Uses the Google Calendar REST API directly with the stored access token
 * (no server-side SDK needed — all calls are simple HTTPS fetches).
 *
 * Sync flow:
 * 1. Check if sync is due (interval elapsed since lastSyncAt)
 * 2. Fetch events for the visible date range from Google Calendar
 * 3. Convert them to CO21 tasks and upsert into the target group
 * 4. Update lastSyncAt / lastSyncRange in user profile
 */
import { getAccessToken } from './googleAuthService';
import { UserStoreController } from './UserController';
import CC from 'src/CCAccess';
import { saveData } from 'src/utils/storageUtils';
import logger from 'src/utils/logger';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

interface GCalEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  updated?: string;
  status?: string;
}

interface GCalListResponse {
  items?: GCalEvent[];
  nextPageToken?: string;
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Check whether a periodic sync is due and run it if so.
 * Called on app startup and after calendar page navigation.
 */
export async function checkAndSync(
  visibleFrom: string,
  visibleTo: string,
): Promise<{ synced: boolean; count: number }> {
  const user = UserStoreController();

  if (!user.isLoaded) {
    await user.load();
  }

  if (!user.isCalendarSyncReady) {
    return { synced: false, count: 0 };
  }

  const sync = user.calendarSync;
  const intervalMs = sync.intervalHours * 60 * 60 * 1000;
  const now = Date.now();

  const requestedRange = `${visibleFrom}/${visibleTo}`;
  const rangeChanged = sync.lastSyncRange !== requestedRange;

  if (sync.lastSyncAt && !rangeChanged) {
    const elapsed = now - new Date(sync.lastSyncAt).getTime();
    if (elapsed < intervalMs) {
      return { synced: false, count: 0 };
    }
  }

  return runSync(visibleFrom, visibleTo);
}

/**
 * Force an immediate sync for the given date range.
 */
export async function runSync(
  visibleFrom: string,
  visibleTo: string,
): Promise<{ synced: boolean; count: number }> {
  const user = UserStoreController();
  const groupId = user.calendarGroupId;
  if (!groupId) return { synced: false, count: 0 };

  const token = await getAccessToken();
  if (!token) {
    logger.warn('[CalendarSync] No valid access token — skipping sync');
    return { synced: false, count: 0 };
  }

  try {
    const events = await fetchCalendarEvents(token, visibleFrom, visibleTo);
    const count = await upsertEventsAsTasks(events, groupId, visibleFrom);

    const range = `${visibleFrom}/${visibleTo}`;
    await user.updateCalendarSyncMeta(new Date().toISOString(), range);

    logger.debug(`[CalendarSync] Synced ${count} events for range ${range}`);
    return { synced: true, count };
  } catch (e) {
    logger.error('[CalendarSync] Sync failed', e);
    return { synced: false, count: 0 };
  }
}

/**
 * Start the periodic sync timer.
 */
export function startSyncScheduler(): void {
  stopSyncScheduler();

  const tick = async () => {
    try {
      const user = UserStoreController();
      if (!user.isCalendarSyncReady) return;

      const sync = user.calendarSync;
      const lastRange = sync.lastSyncRange;
      if (!lastRange) return;

      const [from, to] = lastRange.split('/');
      if (from && to) {
        await checkAndSync(from, to);
      }
    } catch {
      void 0;
    }
  };

  syncTimer = setInterval(() => { void tick(); }, 5 * 60 * 1000);
}

export function stopSyncScheduler(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}

// ── Google Calendar API ──────────────────────────────────────────────────

async function fetchCalendarEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string,
): Promise<GCalEvent[]> {
  const allEvents: GCalEvent[] = [];
  let pageToken: string | undefined;

  const minDate = new Date(timeMin + 'T00:00:00Z').toISOString();
  const maxDate = new Date(timeMax + 'T23:59:59Z').toISOString();

  do {
    const params = new URLSearchParams({
      timeMin: minDate,
      timeMax: maxDate,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetch(
      `${CALENDAR_API}/calendars/primary/events?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Calendar API error (${res.status}): ${text}`);
    }

    const data = (await res.json()) as GCalListResponse;
    if (data.items) {
      allEvents.push(...data.items.filter((e) => e.status !== 'cancelled'));
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allEvents;
}

// ── Event → Task conversion ─────────────────────────────────────────────

async function upsertEventsAsTasks(
  events: GCalEvent[],
  groupId: string,
  _visibleFrom: string,
): Promise<number> {
  let count = 0;

  for (const ev of events) {
    const dateKey = extractDateKey(ev);
    if (!dateKey) continue;

    const existing = findExistingTaskBySourceId(ev.id);

    const name = ev.summary || '(No title)';

    if (existing) {
      const needsUpdate =
        existing.name !== name ||
        existing.description !== (ev.description || '');

      if (needsUpdate) {
        await CC.task.update(dateKey, existing.id, {
          name,
          description: ev.description || '',
          date: dateKey,
          eventDate: dateKey,
          eventTime: extractTime(ev),
        });
        count++;
      }
    } else {
      await CC.task.add(dateKey, {
        name,
        description: ev.description || '',
        date: dateKey,
        type: 'TimeEvent',
        type_id: 'TimeEvent',
        category: 'other',
        priority: 'medium',
        groupId,
        eventDate: dateKey,
        eventTime: extractTime(ev),
        source: 'google-calendar',
        sourceId: ev.id,
      } as any);
      count++;
    }
  }

  if (count > 0) {
    await saveData();
  }

  return count;
}

function extractDateKey(ev: GCalEvent): string | null {
  const raw = ev.start?.date || ev.start?.dateTime;
  if (!raw) return null;
  return raw.slice(0, 10);
}

function extractTime(ev: GCalEvent): string | null {
  const dt = ev.start?.dateTime;
  if (!dt) return null;
  const match = dt.match(/T(\d{2}:\d{2})/);
  return match?.[1] ?? null;
}

function findExistingTaskBySourceId(googleEventId: string): any {
  try {
    const days = CC.task.time?.days?.value ?? {};
    for (const key of Object.keys(days)) {
      const day = days[key];
      if (!day?.tasks) continue;
      const found = day.tasks.find(
        (t: any) => t.sourceId === googleEventId || t.source_id === googleEventId,
      );
      if (found) return found;
    }
    return null;
  } catch {
    return null;
  }
}
