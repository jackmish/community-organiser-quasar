/**
 * LAN organiser sync is triggered when local data is saved (see `lanOrganiserSyncTrigger.ts`).
 * Interval polling is intentionally disabled — contract interval is for agreement only.
 */
export function startLanDataSyncScheduler(): void {
  // no-op: event-driven sync via StorageController.saveData
}

export function stopLanDataSyncScheduler(): void {
  // no-op
}
