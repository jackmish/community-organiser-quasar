/**
 * SyncEngine — orchestrates the sync protocol between two devices.
 *
 * Responsibilities:
 *  - Build a delta payload (entries not yet seen by the remote device).
 *  - Receive and apply a remote delta via lwwMerge.
 *  - Apply winning entries to the in-memory OrganiserData.
 *  - Return the updated data + merge result for the caller to persist.
 *  - Track the sync vector (per-device clock seen) in settings.
 *
 * What SyncEngine does NOT do:
 *  - Transport (BLE, WebRTC, REST) — that is bluetoothBackend / p2pBackend.
 *  - Persistence — the caller (StorageController) saves the returned data.
 *  - UI — conflicts are returned in MergeResult for a component to display.
 *
 * Typical flow (Device A initiates sync with Device B over BLE):
 *
 *   // A side
 *   const payload = engine.buildSyncPayload(localData, syncVector);
 *   await bluetoothBackend.sendChunked(JSON.stringify(payload));
 *
 *   // B side — receives the payload
 *   const { updatedData, result } = engine.applyRemotePayload(localData, payload);
 *   await storageController.saveData(updatedData);
 *   if (result.conflicts.length) showConflictUI(result.conflicts);
 *
 *   // B responds with its own delta so A gets B's changes too
 *   const responsePayload = engine.buildSyncPayload(updatedData, payload.senderVector);
 *   await bluetoothBackend.sendChunked(JSON.stringify(responsePayload));
 */

import type { OrganiserData } from '../backend/StorageBackend';
import type { ChangeEntry, MergeResult, SyncVector } from './ChangeEntry';
import { changeLog } from './changeLog';
import { lwwMerge } from './lwwMerge';
import logger from '../../../utils/logger';

// ---------------------------------------------------------------------------
// Payload shape sent over the wire (BLE / P2P / REST)
// ---------------------------------------------------------------------------

export interface SyncPayload {
  /** Device that built this payload. */
  senderDeviceId: string;

  /** Sync vector of the sender at the time of building the payload.
   *  The receiver uses this to update its own vector after applying. */
  senderVector: SyncVector;

  /** Delta: only the entries the sender believes the receiver hasn't seen. */
  entries: ChangeEntry[];

  /** ISO timestamp of when the payload was built — for logging only. */
  builtAt: string;
}

// ---------------------------------------------------------------------------
// SyncEngine
// ---------------------------------------------------------------------------

export class SyncEngine {
  // ── Building a payload ────────────────────────────────────────────────────

  /**
   * Build a payload to send to a remote device.
   *
   * @param data         - current local OrganiserData (must have a changeLog)
   * @param localDeviceId - this device's ID
   * @param receiverVector - the last known sync vector of the receiving device
   *                         (stored locally from the previous sync with that device)
   *                         Pass {} for a first-ever sync → sends everything.
   */
  buildSyncPayload(
    data: OrganiserData,
    localDeviceId: string,
    receiverVector: SyncVector = {},
  ): SyncPayload {
    const log = data.changeLog ?? [];
    const delta = changeLog.getEntriesSince(log, receiverVector);

    logger.debug(
      `[SyncEngine] building payload: ${delta.length} entries for receiver`,
      receiverVector,
    );

    return {
      senderDeviceId: localDeviceId,
      senderVector: changeLog.buildSyncVector(log),
      entries: delta,
      builtAt: new Date().toISOString(),
    };
  }

  // ── Applying a received payload ────────────────────────────────────────────

  /**
   * Apply a received SyncPayload to local data.
   *
   * Returns:
   *  - `updatedData`: new OrganiserData with merged groups/tasks + merged log
   *  - `result`: MergeResult with applied entries and any conflicts
   *
   * The caller should:
   *  1. Persist `updatedData`.
   *  2. Show `result.conflicts` in the UI if non-empty.
   *  3. Store the updated syncVector for the sender device
   *     (use `data.changeLog` → `buildSyncVector` after save).
   */
  applyRemotePayload(
    localData: OrganiserData,
    payload: SyncPayload,
  ): { updatedData: OrganiserData; result: MergeResult } {
    const localLog = localData.changeLog ?? [];

    // Merge the change logs
    const result = lwwMerge.merge(localLog, payload.entries);

    if (result.applied.length === 0 && result.conflicts.length === 0) {
      logger.debug('[SyncEngine] nothing new to apply');
      return {
        updatedData: {
          ...localData,
          changeLog: changeLog.pruneLog(result.mergedLog),
        },
        result,
      };
    }

    logger.info(
      `[SyncEngine] applying ${result.applied.length} entries, ${result.conflicts.length} conflicts`,
    );

    // Apply winning entries to the actual groups and tasks
    const updatedData = this._applyEntriesToData(localData, result.applied);

    // Update the change log
    const finalLog = changeLog.pruneLog(changeLog.appendEntries(localLog, payload.entries));

    return {
      updatedData: {
        ...updatedData,
        changeLog: finalLog,
        lastModified: new Date().toISOString(),
      },
      result,
    };
  }

  // ── Internal: apply winning entries to OrganiserData fields ───────────────

  private _applyEntriesToData(data: OrganiserData, entries: ChangeEntry[]): OrganiserData {
    if (entries.length === 0) return data;

    // Group entries by entityType + entityId
    const groupEntries = new Map<string, ChangeEntry[]>();
    const taskEntries = new Map<string, ChangeEntry[]>();

    for (const e of entries) {
      const map = e.entityType === 'group' ? groupEntries : taskEntries;
      if (!map.has(e.entityId)) map.set(e.entityId, []);
      map.get(e.entityId)!.push(e);
    }

    // Apply group changes
    let groups = [...(data.groups ?? [])];
    for (const [entityId, eList] of groupEntries) {
      const idx = groups.findIndex((g: any) => g.id === entityId);
      if (idx === -1) {
        // Entity doesn't exist locally — create it from the entries' values if
        // it's not a deletion.
        const isDelete = eList.some((e) => e.field === '$entity' && e.value === null);
        if (!isDelete) {
          const newRecord = this._buildRecordFromEntries(eList);
          if (newRecord) groups = [...groups, newRecord as any];
        }
      } else {
        const updated = lwwMerge.applyEntriesToRecord(groups[idx] as any, eList);
        if (updated === null) {
          // Deletion
          groups = groups.filter((g: any) => g.id !== entityId);
        } else {
          groups = [...groups.slice(0, idx), updated as any, ...groups.slice(idx + 1)];
        }
      }
    }

    // Apply task changes
    let days = { ...(data.days ?? {}) };
    for (const [entityId, eList] of taskEntries) {
      // Find which day holds this task
      let found = false;
      for (const [dateKey, day] of Object.entries(days)) {
        const tasks: any[] = day.tasks ?? [];
        const idx = tasks.findIndex((t: any) => t.id === entityId);
        if (idx === -1) continue;

        found = true;
        const updated = lwwMerge.applyEntriesToRecord(tasks[idx], eList);
        if (updated === null) {
          // Deletion
          days = {
            ...days,
            [dateKey]: { ...day, tasks: tasks.filter((t: any) => t.id !== entityId) },
          };
        } else {
          const newTasks = [...tasks];
          newTasks[idx] = updated;
          days = { ...days, [dateKey]: { ...day, tasks: newTasks } };
        }
        break;
      }

      if (!found) {
        // Task not in any day — check if it's a new task being added
        const isDelete = eList.some((e) => e.field === '$entity' && e.value === null);
        if (!isDelete) {
          const newTask = this._buildRecordFromEntries(eList) as any;
          if (newTask?.date) {
            const dateKey: string = newTask.date;
            const day = days[dateKey] ?? { date: dateKey, tasks: [], notes: '' };
            days = { ...days, [dateKey]: { ...day, tasks: [...(day.tasks ?? []), newTask] } };
          } else {
            logger.warn('[SyncEngine] received new task without a date, skipping', entityId);
          }
        }
      }
    }

    return { ...data, groups, days };
  }

  /**
   * Reconstruct a minimal record from a set of ChangeEntries (for entities
   * that don't exist locally yet).  The entityId is injected as `id`.
   */
  private _buildRecordFromEntries(entries: ChangeEntry[]): Record<string, unknown> | null {
    if (entries.length === 0) return null;
    const record: Record<string, unknown> = { id: entries[0]!.entityId };
    for (const e of entries) {
      if (e.field !== '$entity') record[e.field] = e.value;
    }
    return record;
  }
}

export const syncEngine = new SyncEngine();
