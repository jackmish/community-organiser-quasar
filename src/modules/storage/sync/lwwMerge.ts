/**
 * lwwMerge — field-level Last-Write-Wins merge of two change logs.
 *
 * "Last Write Wins" means: for any (entityId, field) pair that was changed
 * by BOTH sides, the entry with the newer timestamp is applied.  If timestamps
 * are identical, the higher logical clock wins.  If both are identical too,
 * the lexicographically larger deviceId wins — purely for determinism.
 *
 * All four scenarios from the requirements:
 *
 *  1. Remote newer, local untouched
 *     → no local entry for that field → remote entry wins unconditionally
 *
 *  2. Both changed different fields (e.g. name vs color)
 *     → different `field` key → both entries are applied, no conflict
 *
 *  3. Both changed same text field (e.g. description)
 *     → LWW: newest timestamp wins (whole field value is replaced)
 *     → character-level merge NOT implemented here — add Automerge.Text later
 *       if collaborative real-time editing is needed
 *
 *  4. Both changed same simple field (e.g. color)
 *     → LWW: newest timestamp wins; deterministic tiebreaker as above
 *
 * This function is PURE — it only produces a MergeResult.
 * Applying the result to OrganiserData is the caller's job (SyncEngine.ts).
 */

import type { ChangeEntry, SyncConflict, MergeResult } from './ChangeEntry';

// ---------------------------------------------------------------------------
// Comparison helpers
// ---------------------------------------------------------------------------

/**
 * Returns positive if `a` is "newer" than `b`, negative if older, 0 if equal.
 * Used to decide which entry wins in LWW.
 */
function compareEntries(a: ChangeEntry, b: ChangeEntry): number {
  // 1. ISO timestamp — lexicographic comparison works because ISO-8601 is sortable
  const tDiff = a.timestamp.localeCompare(b.timestamp);
  if (tDiff !== 0) return tDiff;

  // 2. Logical clock (monotonic counter per device)
  if (a.clock !== b.clock) return a.clock - b.clock;

  // 3. DeviceId — lexicographic, purely for determinism
  return a.deviceId.localeCompare(b.deviceId);
}

function isNewer(candidate: ChangeEntry, existing: ChangeEntry): boolean {
  return compareEntries(candidate, existing) > 0;
}

function areEqual(a: ChangeEntry, b: ChangeEntry): boolean {
  return compareEntries(a, b) === 0;
}

// ---------------------------------------------------------------------------
// Core merge
// ---------------------------------------------------------------------------

/**
 * Merge `remoteEntries` into `localEntries` using field-level LWW.
 *
 * @param localEntries  - change log from the local device
 * @param remoteEntries - delta received from the remote device (already filtered
 *                        to "entries local hasn't seen yet" by SyncEngine)
 * @returns MergeResult — never throws
 */
export function merge(localEntries: ChangeEntry[], remoteEntries: ChangeEntry[]): MergeResult {
  if (remoteEntries.length === 0) {
    return { mergedLog: localEntries, applied: [], conflicts: [] };
  }

  // Build an index of local entries keyed by (entityId, field) → best local entry.
  // "Best" = the most recent local entry for that (entity, field) pair.
  const localIndex = new Map<string, ChangeEntry>();
  for (const e of localEntries) {
    const key = `${e.entityId}::${e.field}`;
    const existing = localIndex.get(key);
    if (!existing || isNewer(e, existing)) {
      localIndex.set(key, e);
    }
  }

  const applied: ChangeEntry[] = [];
  const conflicts: SyncConflict[] = [];

  // Entries from remote that win (to be added to the merged log)
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

    if (areEqual(remote, local)) {
      // Exact same change reached us from two paths — deduplicate, no conflict.
      // (This happens when device C relays A's change to B.)
      continue;
    }

    if (isNewer(remote, local)) {
      // Scenarios 3 & 4: remote is newer → remote wins
      remoteWinners.push(remote);
      applied.push(remote);
    } else {
      // Local is newer → local wins, remote is discarded.
      // We still record this in the merged log (the remote entry exists in
      // history) but it is NOT applied to the data.

      // Check for a true conflict (same timestamp + clock: indistinguishable)
      const cmp = compareEntries(local, remote);
      if (cmp === 0) {
        // Absolute tie even after all tiebreakers — genuinely ambiguous.
        // Record as a conflict for the UI to surface.
        conflicts.push({
          field: remote.field,
          entityType: remote.entityType,
          entityId: remote.entityId,
          local,
          remote,
        });
      }
      // Remote entry is still kept in the log for history visibility
      remoteWinners.push(remote);
    }
  }

  // Deduplicate the merged log using entry IDs
  const seen = new Set(localEntries.map((e) => e.id));
  const novel = remoteWinners.filter((e) => !seen.has(e.id));
  const mergedLog = [...localEntries, ...novel];

  return { mergedLog, applied, conflicts };
}

// ---------------------------------------------------------------------------
// Apply entries to a data record
// ---------------------------------------------------------------------------

/**
 * Apply a list of ChangeEntries to a plain JS object (group or task record).
 * Returns a new object — does not mutate the original.
 *
 * Only 'set' and 'delete' operations on the '$entity' sentinel are handled.
 * Field paths are flat (no nested dot-notation traversal yet — add if needed).
 */
export function applyEntriesToRecord(
  record: Record<string, unknown>,
  entries: ChangeEntry[],
): Record<string, unknown> | null {
  let result: Record<string, unknown> = { ...record };

  // Sort so oldest entries are applied first (newest wins at the end)
  const sorted = [...entries].sort(compareEntries);

  for (const entry of sorted) {
    if (entry.field === '$entity' && entry.value === null) {
      // Deletion — signal caller to remove this entity
      return null;
    }
    result = { ...result, [entry.field]: entry.value };
  }

  return result;
}
