import { patchCo21Settings, loadCo21Settings } from './roleProfileSettings';

export const SYNC_RUNS_CHANGED_EVENT = 'co21:sync-runs-changed';

export type SyncRunStatus = 'queued' | 'running' | 'ok' | 'failed';

export type SyncRunRecord = {
  id: string;
  peerDeviceId: string;
  peerDeviceName: string;
  status: SyncRunStatus;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  incremental: boolean;
  message?: string;
  groupsSent?: number;
  tasksSent?: number;
  groupsReceived?: number;
  tasksReceived?: number;
};

export function dispatchSyncRunsChanged(): void {
  window.dispatchEvent(new Event(SYNC_RUNS_CHANGED_EVENT));
}

function normalizeRun(raw: unknown): SyncRunRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as SyncRunRecord;
  if (typeof o.id !== 'string' || typeof o.peerDeviceId !== 'string') return null;
  const status =
    o.status === 'queued' ||
    o.status === 'running' ||
    o.status === 'ok' ||
    o.status === 'failed'
      ? o.status
      : 'queued';
  return {
    id: o.id,
    peerDeviceId: o.peerDeviceId,
    peerDeviceName: typeof o.peerDeviceName === 'string' ? o.peerDeviceName : o.peerDeviceId,
    status,
    createdAt: typeof o.createdAt === 'number' ? o.createdAt : Date.now(),
    incremental: !!o.incremental,
    ...(typeof o.startedAt === 'number' ? { startedAt: o.startedAt } : {}),
    ...(typeof o.finishedAt === 'number' ? { finishedAt: o.finishedAt } : {}),
    ...(typeof o.message === 'string' ? { message: o.message } : {}),
    ...(typeof o.groupsSent === 'number' ? { groupsSent: o.groupsSent } : {}),
    ...(typeof o.tasksSent === 'number' ? { tasksSent: o.tasksSent } : {}),
    ...(typeof o.groupsReceived === 'number' ? { groupsReceived: o.groupsReceived } : {}),
    ...(typeof o.tasksReceived === 'number' ? { tasksReceived: o.tasksReceived } : {}),
  };
}

export async function loadSyncRuns(): Promise<SyncRunRecord[]> {
  const data = await loadCo21Settings();
  const raw = data.syncRunLog;
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeRun).filter((r): r is SyncRunRecord => !!r);
}

async function saveSyncRuns(runs: SyncRunRecord[]): Promise<void> {
  const trimmed = runs.slice(-40);
  await patchCo21Settings({ syncRunLog: trimmed });
}

export async function enqueueSyncRun(opts: {
  peerDeviceId: string;
  peerDeviceName: string;
  incremental: boolean;
}): Promise<SyncRunRecord> {
  const run: SyncRunRecord = {
    id: crypto.randomUUID(),
    peerDeviceId: opts.peerDeviceId,
    peerDeviceName: opts.peerDeviceName,
    status: 'queued',
    createdAt: Date.now(),
    incremental: opts.incremental,
  };
  const list = await loadSyncRuns();
  list.push(run);
  await saveSyncRuns(list);
  dispatchSyncRunsChanged();
  return run;
}

export async function updateSyncRun(
  id: string,
  patch: Partial<SyncRunRecord>,
): Promise<SyncRunRecord | null> {
  const list = await loadSyncRuns();
  const idx = list.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  const next = { ...list[idx]!, ...patch, id };
  list[idx] = next;
  await saveSyncRuns(list);
  dispatchSyncRunsChanged();
  return next;
}
