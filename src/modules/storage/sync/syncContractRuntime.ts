import type { SyncContractSnapshot } from './syncContractSettings';

/** In-memory active contract (avoids disk race before settings.json flush). */
let active: SyncContractSnapshot | null = null;

export function setSyncContractRuntime(snapshot: SyncContractSnapshot | null): void {
  active = snapshot;
}

export function getSyncContractRuntime(): SyncContractSnapshot | null {
  return active;
}
