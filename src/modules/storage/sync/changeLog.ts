/**
 * ChangeLog — methods for building and querying the change log.
 *
 * All methods are pure: they receive and return plain arrays of ChangeEntry
 * and never perform IO.  Persistence is the caller's responsibility.
 *
 * Usage:
 *   import { changeLog } from 'src/modules/storage/sync/changeLog';
 *   const entry = changeLog.buildEntry(deviceId, clock, 'task', id, 'title', newVal);
 */

import type { ChangeEntry, ChangeEntityType, SyncVector } from './ChangeEntry';

export class ChangeLog {
  /** Maximum entries retained per device. Keeps the stored JSON small. */
  static readonly MAX_PER_DEVICE = 200;

  // ── Building entries ──────────────────────────────────────────────────────

  /**
   * Create a ChangeEntry for a field update.
   *
   * @param deviceId      - authoring device
   * @param clock         - current logical clock value for this device
   * @param entityType    - 'group' | 'task'
   * @param entityId      - ID of the mutated record
   * @param field         - dot-path of the changed field (e.g. 'name', 'color')
   * @param value         - new value
   * @param previousValue - old value (optional, for conflict display)
   */
  buildEntry(
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
  buildDeleteEntry(
    deviceId: string,
    clock: number,
    entityType: ChangeEntityType,
    entityId: string,
  ): ChangeEntry {
    return this.buildEntry(deviceId, clock, entityType, entityId, '$entity', null);
  }

  /**
   * Given an old record and a new record, diff their fields and return one
   * ChangeEntry per changed field.  Only primitive / JSON-serialisable leaf
   * values are compared; nested objects are compared by JSON.stringify.
   */
  diffToEntries(
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
        entries.push(this.buildEntry(deviceId, c++, entityType, entityId, key, newVal, oldVal));
      }
    }

    return entries;
  }

  // ── Querying ──────────────────────────────────────────────────────────────

  /**
   * Return entries newer than the given sync vector for each device.
   * Used to build the delta payload for a remote device.
   * Pass {} as sinceVector for a full sync (sends everything).
   */
  getEntriesSince(log: ChangeEntry[], sinceVector: SyncVector): ChangeEntry[] {
    return log.filter((e) => {
      const seen = sinceVector[e.deviceId] ?? 0;
      return e.clock > seen;
    });
  }

  /**
   * Return the N most recent entries across all devices, sorted newest-first.
   * Used by the history UI ("last N changes").
   */
  getRecent(log: ChangeEntry[], n: number = 10): ChangeEntry[] {
    return [...log]
      .sort((a, b) => {
        const tDiff = b.timestamp.localeCompare(a.timestamp);
        if (tDiff !== 0) return tDiff;
        return b.clock - a.clock;
      })
      .slice(0, n);
  }

  /** Return all entries for a specific entity, sorted newest-first. */
  getEntriesForEntity(log: ChangeEntry[], entityId: string): ChangeEntry[] {
    return log
      .filter((e) => e.entityId === entityId)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp) || b.clock - a.clock);
  }

  // ── Appending ─────────────────────────────────────────────────────────────

  /**
   * Append new entries to the log, skipping any whose `id` already exists.
   * Idempotent — safe to call with the same entry twice during sync.
   * Returns a new array (does not mutate the original).
   */
  appendEntries(log: ChangeEntry[], incoming: ChangeEntry[]): ChangeEntry[] {
    const existingIds = new Set(log.map((e) => e.id));
    const novel = incoming.filter((e) => !existingIds.has(e.id));
    return [...log, ...novel];
  }

  // ── Pruning ───────────────────────────────────────────────────────────────

  /**
   * Keep only the most recent MAX_PER_DEVICE entries per device.
   * Call after every save to prevent unbounded log growth.
   * Returns a new array (does not mutate the original).
   */
  pruneLog(log: ChangeEntry[], maxPerDevice = ChangeLog.MAX_PER_DEVICE): ChangeEntry[] {
    const byDevice = new Map<string, ChangeEntry[]>();
    for (const e of log) {
      if (!byDevice.has(e.deviceId)) byDevice.set(e.deviceId, []);
      byDevice.get(e.deviceId)!.push(e);
    }

    const kept: ChangeEntry[] = [];
    for (const [, entries] of byDevice) {
      const sorted = entries.sort((a, b) => b.clock - a.clock);
      kept.push(...sorted.slice(0, maxPerDevice));
    }

    return kept;
  }

  // ── Sync vector helpers ───────────────────────────────────────────────────

  /**
   * Build a SyncVector from a log — sets each deviceId to the highest clock
   * value seen for that device.
   */
  buildSyncVector(log: ChangeEntry[]): SyncVector {
    const vector: SyncVector = {};
    for (const e of log) {
      if ((vector[e.deviceId] ?? -1) < e.clock) {
        vector[e.deviceId] = e.clock;
      }
    }
    return vector;
  }

  /** Merge two SyncVectors, keeping the highest clock value per device. */
  mergeSyncVectors(a: SyncVector, b: SyncVector): SyncVector {
    const result: SyncVector = { ...a };
    for (const [deviceId, clock] of Object.entries(b)) {
      if ((result[deviceId] ?? -1) < clock) result[deviceId] = clock;
    }
    return result;
  }
}

export const changeLog = new ChangeLog();
