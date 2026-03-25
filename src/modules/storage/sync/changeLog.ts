/**
 * changeLog — pure functions for building and querying the change log.
 *
 * These functions never perform IO.  They receive and return plain arrays of
 * ChangeEntry.  Persistence (reading/writing the log as part of OrganiserData)
 * is the caller's responsibility.
 *
 * Keeping mutations here as pure functions makes them trivially unit-testable
 * and side-effect free — the same philosophy used by groupManager.ts.
 */

import type { ChangeEntry, ChangeEntityType, SyncVector } from './ChangeEntry';

// ---------------------------------------------------------------------------
// Maximum entries to retain per device in the log.
// Keeps the stored JSON small.  Older entries are pruned after this limit.
// For UI "last N changes" the caller slices the result of getRecent().
// ---------------------------------------------------------------------------
export const MAX_LOG_ENTRIES_PER_DEVICE = 200;

// ---------------------------------------------------------------------------
// Building entries
// ---------------------------------------------------------------------------

/**
 * Create a ChangeEntry for a field update.
 *
 * @param deviceId   - authoring device
 * @param clock      - current logical clock value for this device (from settings)
 * @param entityType - 'group' | 'task'
 * @param entityId   - ID of the mutated record
 * @param field      - dot-path of the changed field (e.g. 'name', 'color')
 * @param value      - new value
 * @param previousValue - old value (optional, for conflict display)
 */
export function buildEntry(
  deviceId: string,
  clock: number,
  entityType: ChangeEntityType,
  entityId: string,
  field: string,
  value: unknown,
  previousValue?: unknown,
): ChangeEntry {
  return {
    id: crypto.randomUUID(),
    deviceId,
    timestamp: new Date().toISOString(),
    clock,
    entityType,
    entityId,
    field,
    value,
    ...(previousValue !== undefined ? { previousValue } : {}),
  };
}

/**
 * Convenience: create a ChangeEntry for a full entity deletion.
 * The sentinel field '$entity' signals that the entire record was removed.
 */
export function buildDeleteEntry(
  deviceId: string,
  clock: number,
  entityType: ChangeEntityType,
  entityId: string,
): ChangeEntry {
  return buildEntry(deviceId, clock, entityType, entityId, '$entity', null);
}

/**
 * Given an old record and a new record, diff their fields and return one
 * ChangeEntry per changed field.  Only primitive / JSON-serialisable leaf
 * values are compared; nested objects are compared by JSON.stringify.
 */
export function diffToEntries(
  deviceId: string,
  clock: number,
  entityType: ChangeEntityType,
  entityId: string,
  oldRecord: Record<string, unknown>,
  newRecord: Record<string, unknown>,
): ChangeEntry[] {
  const allKeys = new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)]);
  const entries: ChangeEntry[] = [];
  let c = clock;

  for (const key of allKeys) {
    // Skip internal / computed properties
    if (key.startsWith('_')) continue;

    const oldVal = oldRecord[key];
    const newVal = newRecord[key];

    const same =
      oldVal === newVal ||
      (oldVal !== null &&
        newVal !== null &&
        typeof oldVal === 'object' &&
        typeof newVal === 'object' &&
        JSON.stringify(oldVal) === JSON.stringify(newVal));

    if (!same) {
      entries.push(buildEntry(deviceId, c++, entityType, entityId, key, newVal, oldVal));
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Querying
// ---------------------------------------------------------------------------

/**
 * Return entries newer than the given sync vector entry for a specific device.
 * Used to build the delta payload when Device A asks "what's new since our
 * last sync?".
 *
 * If `sinceVector` is empty or doesn't contain `deviceId`, all entries from
 * that device are returned (full sync).
 */
export function getEntriesSince(log: ChangeEntry[], sinceVector: SyncVector): ChangeEntry[] {
  return log.filter((e) => {
    const seen = sinceVector[e.deviceId] ?? 0;
    return e.clock > seen;
  });
}

/**
 * Return the N most recent entries across all devices, sorted newest-first.
 * Used by the history UI ("last 3 changes").
 */
export function getRecent(log: ChangeEntry[], n: number = 10): ChangeEntry[] {
  return [...log]
    .sort((a, b) => {
      // Primary: timestamp descending
      const tDiff = b.timestamp.localeCompare(a.timestamp);
      if (tDiff !== 0) return tDiff;
      // Secondary: clock descending (same-millisecond tiebreaker)
      return b.clock - a.clock;
    })
    .slice(0, n);
}

/**
 * Return all entries for a specific entity, sorted newest-first.
 */
export function getEntriesForEntity(log: ChangeEntry[], entityId: string): ChangeEntry[] {
  return log
    .filter((e) => e.entityId === entityId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp) || b.clock - a.clock);
}

// ---------------------------------------------------------------------------
// Appending
// ---------------------------------------------------------------------------

/**
 * Append new entries to the log, skipping any whose `id` already exists
 * (idempotent — safe to call with the same entry twice during sync).
 * Returns the new log array (does not mutate the original).
 */
export function appendEntries(log: ChangeEntry[], incoming: ChangeEntry[]): ChangeEntry[] {
  const existingIds = new Set(log.map((e) => e.id));
  const novel = incoming.filter((e) => !existingIds.has(e.id));
  return [...log, ...novel];
}

// ---------------------------------------------------------------------------
// Pruning
// ---------------------------------------------------------------------------

/**
 * Keep only the most recent MAX_LOG_ENTRIES_PER_DEVICE entries per device.
 * Called after every save to prevent unbounded log growth.
 * Returns the pruned log (does not mutate the original).
 */
export function pruneLog(
  log: ChangeEntry[],
  maxPerDevice = MAX_LOG_ENTRIES_PER_DEVICE,
): ChangeEntry[] {
  // Group by deviceId
  const byDevice = new Map<string, ChangeEntry[]>();
  for (const e of log) {
    if (!byDevice.has(e.deviceId)) byDevice.set(e.deviceId, []);
    byDevice.get(e.deviceId)!.push(e);
  }

  const kept: ChangeEntry[] = [];
  for (const [, entries] of byDevice) {
    // Keep the most recent maxPerDevice entries for this device
    const sorted = entries.sort((a, b) => b.clock - a.clock);
    kept.push(...sorted.slice(0, maxPerDevice));
  }

  return kept;
}

// ---------------------------------------------------------------------------
// Sync vector helpers
// ---------------------------------------------------------------------------

/**
 * Build an updated SyncVector by scanning a log — sets each deviceId to the
 * highest clock value seen for that device.
 */
export function buildSyncVector(log: ChangeEntry[]): SyncVector {
  const vector: SyncVector = {};
  for (const e of log) {
    if ((vector[e.deviceId] ?? -1) < e.clock) {
      vector[e.deviceId] = e.clock;
    }
  }
  return vector;
}

/**
 * Merge two SyncVectors, keeping the highest clock value per device.
 */
export function mergeSyncVectors(a: SyncVector, b: SyncVector): SyncVector {
  const result: SyncVector = { ...a };
  for (const [deviceId, clock] of Object.entries(b)) {
    if ((result[deviceId] ?? -1) < clock) result[deviceId] = clock;
  }
  return result;
}
