/**
 * LwwMerge — field-level Last-Write-Wins merge of two change logs.
 *
 * "Last Write Wins" means: for any (entityId, field) pair changed by BOTH
 * sides, the entry with the newer timestamp is applied.  Tiebreaker order:
 *   1. timestamp (ISO-8601, lexicographic)
 *   2. logical clock
 *   3. deviceId (lexicographic, purely for determinism)
 *
 * Scenarios:
 *  1. Remote newer, local untouched   → remote wins unconditionally
 *  2. Both changed different fields   → both applied, no conflict
 *  3. Both changed same field (text)  → LWW (whole-field replacement)
 *  4. Both changed same simple field  → LWW with deterministic tiebreaker
 *
 * Usage:
 *   import { lwwMerge } from 'src/modules/storage/sync/lwwMerge';
 *   const result = lwwMerge.merge(localEntries, remoteEntries);
 */

import type { ChangeEntry, SyncConflict, MergeResult } from './ChangeEntry';

export class LwwMerge {
  // ── Comparison helpers ────────────────────────────────────────────────────

  /**
   * Returns positive if `a` is "newer" than `b`, negative if older, 0 if equal.
   */
  private compare(a: ChangeEntry, b: ChangeEntry): number {
    const tDiff = a.timestamp.localeCompare(b.timestamp);
    if (tDiff !== 0) return tDiff;
    if (a.clock !== b.clock) return a.clock - b.clock;
    return a.deviceId.localeCompare(b.deviceId);
  }

  private isNewer(candidate: ChangeEntry, existing: ChangeEntry): boolean {
    return this.compare(candidate, existing) > 0;
  }

  private areEqual(a: ChangeEntry, b: ChangeEntry): boolean {
    return this.compare(a, b) === 0;
  }

  // ── Core merge ────────────────────────────────────────────────────────────

  /**
   * Merge `remoteEntries` into `localEntries` using field-level LWW.
   *
   * @param localEntries  - change log from the local device
   * @param remoteEntries - delta received from the remote device
   * @returns MergeResult — never throws
   */
  merge(localEntries: ChangeEntry[], remoteEntries: ChangeEntry[]): MergeResult {
    if (remoteEntries.length === 0) {
      return { mergedLog: localEntries, applied: [], conflicts: [] };
    }

    // Build an index of the best (most recent) local entry per (entityId, field).
    const localIndex = new Map<string, ChangeEntry>();
    for (const e of localEntries) {
      const key = `${e.entityId}::${e.field}`;
      const existing = localIndex.get(key);
      if (!existing || this.isNewer(e, existing)) {
        localIndex.set(key, e);
      }
    }

    const applied: ChangeEntry[] = [];
    const conflicts: SyncConflict[] = [];
    const remoteWinners: ChangeEntry[] = [];

    for (const remote of remoteEntries) {
      const key = `${remote.entityId}::${remote.field}`;
      const local = localIndex.get(key);

      if (!local) {
        // Scenario 1 / 2: no competing local change → remote wins outright
        remoteWinners.push(remote);
        applied.push(remote);
        continue;
      }

      if (this.areEqual(remote, local)) {
        // Same change reached us from two paths — deduplicate, no conflict.
        continue;
      }

      if (this.isNewer(remote, local)) {
        // Scenarios 3 & 4: remote is newer → remote wins
        remoteWinners.push(remote);
        applied.push(remote);
      } else {
        // Local is newer → local wins; remote is still kept in history.
        const cmp = this.compare(local, remote);
        if (cmp === 0) {
          // Absolute tie even after all tiebreakers — surface as a conflict.
          conflicts.push({
            field: remote.field,
            entityType: remote.entityType,
            entityId: remote.entityId,
            local,
            remote,
          });
        }
        remoteWinners.push(remote);
      }
    }

    // Deduplicate the merged log using entry IDs
    const seen = new Set(localEntries.map((e) => e.id));
    const novel = remoteWinners.filter((e) => !seen.has(e.id));
    const mergedLog = [...localEntries, ...novel];

    return { mergedLog, applied, conflicts };
  }

  // ── Apply entries to a data record ────────────────────────────────────────

  /**
   * Apply a list of ChangeEntries to a plain JS object (group or task record).
   * Returns a new object — does not mutate the original.
   * Returns null if a '$entity' deletion sentinel is present.
   */
  applyEntriesToRecord(
    record: Record<string, unknown>,
    entries: ChangeEntry[],
  ): Record<string, unknown> | null {
    let result: Record<string, unknown> = { ...record };

    // Sort so oldest entries are applied first (newest wins at the end)
    const sorted = [...entries].sort((a, b) => this.compare(a, b));

    for (const entry of sorted) {
      if (entry.field === '$entity' && entry.value === null) {
        return null;
      }
      result = { ...result, [entry.field]: entry.value };
    }

    return result;
  }
}

export const lwwMerge = new LwwMerge();
