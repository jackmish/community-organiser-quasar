/**
 * ChangeEntry — the atomic unit of the sync change log.
 *
 * Every mutation (create / update / delete) on a Group or Task produces one
 * or more ChangeEntries — one per changed field.  This field-level granularity
 * is what enables scenario 2 (merge different fields) and distinguishes it
 * from a naive "last full-record wins" approach.
 *
 * Scenarios handled:
 *  1. Remote newer, local untouched   → remote entry applied (no conflicting local entry)
 *  2. Both changed different fields   → both entries applied  (different `field` keys)
 *  3. Both changed same field (text)  → newest `timestamp` wins (LWW for whole field value)
 *     NOTE: character-level text merge is not implemented. If needed later,
 *     swap the description field for an Automerge.Text or add a diff3 merge.
 *  4. Both changed same simple field  → newest `timestamp` wins; deviceId as tiebreaker
 *
 * The log is intentionally kept shallow — no nested diffs, no operation types
 * beyond set/delete.  If richer semantics are needed, extend `op` first.
 */

// ---------------------------------------------------------------------------
// Entity types that can appear in the change log
// ---------------------------------------------------------------------------

export type ChangeEntityType = 'group' | 'task';

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

export type ChangeOp =
  | 'set' // field was created or updated
  | 'delete'; // entire entity was deleted (field is '$entity', value is null)

// ---------------------------------------------------------------------------
// Core type
// ---------------------------------------------------------------------------

export interface ChangeEntry {
  /** Stable UUID for this specific change (for deduplication across devices). */
  id: string;

  /** Device that produced this change. */
  deviceId: string;

  /** ISO-8601 timestamp — wall clock time on the authoring device. */
  timestamp: string;

  /** Logical clock counter per device — monotonically increasing integer.
   *  Used as a tiebreaker when two entries share the exact same `timestamp`.
   *  Each device maintains its own counter (stored in settings as `syncClock`). */
  clock: number;

  entityType: ChangeEntityType;

  /** ID of the group or task that was changed. */
  entityId: string;

  /** Dot-notation field path, e.g. 'name', 'color', 'description'.
   *  For entity deletion use the sentinel '$entity'. */
  field: string;

  /** The new value after the change.  `null` for deletions. */
  value: unknown;

  /** The value before the change — optional, used for conflict UI display only.
   *  May be absent for entries received from a remote device on first sync. */
  previousValue?: unknown;
}

// ---------------------------------------------------------------------------
// Sync vector — tracks what each device has already seen from every other device
// ---------------------------------------------------------------------------

/**
 * A SyncVector maps deviceId → highest clock value already applied from that device.
 * Stored in settings under 'syncVector'.
 *
 * To get "changes I haven't seen yet from device X":
 *   entries.filter(e => e.deviceId === X && e.clock > syncVector[X] ?? 0)
 */
export type SyncVector = Record<string, number>;

// ---------------------------------------------------------------------------
// Conflict — two entries for the same (entityId, field) where neither is
// clearly dominant (same timestamp AND same clock).  Extremely rare in practice.
// ---------------------------------------------------------------------------

export interface SyncConflict {
  field: string;
  entityType: ChangeEntityType;
  entityId: string;
  local: ChangeEntry;
  remote: ChangeEntry;
}

// ---------------------------------------------------------------------------
// Result returned by the merge operation
// ---------------------------------------------------------------------------

export interface MergeResult {
  /** All entries from both sides, deduplicated. */
  mergedLog: ChangeEntry[];
  /** Entries that were applied to the local data (new to local). */
  applied: ChangeEntry[];
  /** True conflicts (same field, indistinguishable timestamp + clock). */
  conflicts: SyncConflict[];
}
