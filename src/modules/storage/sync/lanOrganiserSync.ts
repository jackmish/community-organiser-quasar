import CC from 'src/CCAccess';
import { co21LanBaseUrl } from 'src/modules/lan/lanPairingConstants';
import {
  adoptLanSyncNextToken,
  isLanSyncTokenValid,
  lanSyncExchangeNextToken,
  LAN_SYNC_TOKEN_DISABLED,
  toPlainLanSyncExchangeResponse,
  type LanSyncExchangeRequest,
  type LanSyncExchangeResponse,
} from 'src/modules/lan/lanSyncAuth';
import { lanPostSyncExchange } from 'src/modules/lan/lanSyncTransport';
import { loadActiveContractForSync, type SyncContractSnapshot } from './syncContractSettings';
import type { GroupRecord } from './deviceRoleAssignment';
import { contractGroupIds } from './syncContractScope';
import {
  applyTaskDeletionsToFlatList,
  daysFromMergedTasks,
  groupPayloadFromLocalAsync,
  mergeGroupsById,
  mergeTasksByNewest,
  taskPayloadFromFlat,
  type FlatTask,
} from './organiserLanMerge';
import { adoptInboundGroupBackground } from 'src/modules/group/utils/groupBackgroundStorage';
import {
  listTaskDeletionsForSync,
  mergeRemoteTaskDeletions,
  pruneTaskDeletionTombstones,
  type TaskDeletionTombstone,
} from './taskDeletionLog';
import type { LanSyncTaskDeletionPayload } from 'src/modules/lan/lanSyncAuth';
import {
  adoptNextSyncToken,
  ensurePeerSyncSession,
  findSyncPeerState,
  upsertSyncPeerState,
  type SyncPeerRecord,
} from './syncPeerState';
import { withOrganiserSyncTriggerSuppressed } from './lanOrganiserSyncTrigger';
import { enqueueSyncRun, updateSyncRun } from './syncRunQueue';
import { loadOwnDeviceMeta } from './deviceRoleAssignment';
import logger from 'src/utils/logger';
import type { Group } from 'src/modules/group/models/GroupModel';

function tsMs(v: string | undefined): number {
  if (!v) return 0;
  const n = Date.parse(v);
  return Number.isFinite(n) ? n : 0;
}

/** Avoid `String(object)` → `[object Object]` on persisted task/group fields. */
function asOptionalString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

/** Prefer canonical day storage over flat list (flat list can lag after LAN apply). */
function collectFlatTasks(): FlatTask[] {
  const out: FlatTask[] = [];
  try {
    const days = CC.task?.time?.days?.value ?? {};
    for (const day of Object.values(days) as { tasks?: unknown[] }[]) {
      if (!Array.isArray(day?.tasks)) continue;
      for (const t of day.tasks) {
        if (t && typeof t === 'object' && (t as FlatTask).id) {
          out.push(t as FlatTask);
        }
      }
    }
    if (out.length) return out;
    const items = CC.task?.list?.items?.() ?? [];
    for (const t of items) {
      const row = t as unknown as FlatTask;
      if (row.id) out.push(row);
    }
  } catch {
    void 0;
  }
  return out;
}

function refreshTaskFlatListFromDays(): void {
  try {
    CC.task?.refreshFlatListFromDays?.();
  } catch {
    void 0;
  }
}

function filterTasksForSyncOutbound(
  tasks: FlatTask[],
  peer: SyncPeerRecord | null,
  globalSinceMs: number,
): FlatTask[] {
  if (!globalSinceMs) return tasks;
  return tasks.filter((t) => {
    const id = String(t.id);
    const perTask = peer?.taskSyncedAt[id];
    if (perTask === undefined) return true;
    const wm = perTask > 0 ? perTask : globalSinceMs;
    return tsMs(t.updatedAt) > wm;
  });
}

function filterGroupsForSyncOutbound<G extends { id: string; updatedAt?: string }>(
  groups: G[],
  peer: SyncPeerRecord | null,
  globalSinceMs: number,
): G[] {
  if (!globalSinceMs) return groups;
  return groups.filter((g) => {
    const id = String(g.id);
    const perGroup = peer?.groupSyncedAt[id];
    if (perGroup === undefined) return true;
    const wm = perGroup > 0 ? perGroup : globalSinceMs;
    return tsMs(g.updatedAt) > wm;
  });
}

function groupRecordsForScope(): GroupRecord[] {
  return (CC.group?.list?.all?.value ?? []).map((g) => ({
    id: String(g.id),
    name: g.name ?? '',
    parentId: g.parentId ?? null,
  }));
}

async function resolveSyncScope(contract: SyncContractSnapshot): Promise<Set<string>> {
  const groups = groupRecordsForScope();
  const { loadConnectedDevices } = await import('./deviceRoleAssignment');
  const devices = await loadConnectedDevices();
  return contractGroupIds(contract, groups, devices);
}

function filterGroupsInScope(groups: Group[], scope: Set<string>): Group[] {
  if (!scope.size) return groups;
  return groups.filter((g) => scope.has(String(g.id)));
}

function filterTasksInScope(tasks: FlatTask[], scope: Set<string>): FlatTask[] {
  if (!scope.size) return tasks;
  return tasks.filter((t) => {
    const gid = asOptionalString(t.groupId);
    return gid && scope.has(gid);
  });
}

function markSyncedFlags(
  peer: SyncPeerRecord,
  groups: { id: string; updatedAt?: string }[],
  tasks: { id: string; updatedAt?: string }[],
  deletions: LanSyncTaskDeletionPayload[] = [],
): SyncPeerRecord {
  const now = Date.now();
  const groupSyncedAt = { ...peer.groupSyncedAt };
  const taskSyncedAt = { ...peer.taskSyncedAt };
  for (const g of groups) {
    groupSyncedAt[String(g.id)] = tsMs(g.updatedAt) || now;
  }
  for (const t of tasks) {
    taskSyncedAt[String(t.id)] = tsMs(t.updatedAt) || now;
  }
  for (const d of deletions) {
    taskSyncedAt[String(d.id)] = tsMs(d.deletedAt) || now;
  }
  return { ...peer, groupSyncedAt, taskSyncedAt };
}

async function adoptMergedGroupBackgrounds(
  merged: Group[],
  remote: LanSyncExchangeRequest['groups'],
): Promise<void> {
  const remoteById = new Map((remote ?? []).map((r) => [String(r.id), r]));
  for (const g of merged) {
    const r = remoteById.get(String(g.id));
    if (!r || r.backgroundImage === undefined) continue;
    const localMs = tsMs(g.updatedAt);
    const remoteMs = tsMs(r.updatedAt);
    if (remoteMs < localMs) continue;
    const ref = await adoptInboundGroupBackground(String(g.id), r.backgroundImage ?? null);
    if (ref) g.backgroundImage = ref;
    else {
      delete (g as { backgroundImage?: string }).backgroundImage;
      delete (g as { background_image?: string }).background_image;
    }
  }
}

/** Build outbound delta for contract-scoped groups/tasks/deletions. */
export async function buildOutboundSyncDelta(opts: {
  sinceMs: number;
  scope: Set<string>;
  peer?: SyncPeerRecord | null;
}): Promise<{
  groups: Awaited<ReturnType<typeof groupPayloadFromLocalAsync>>[];
  tasks: ReturnType<typeof taskPayloadFromFlat>[];
  deletedTasks: TaskDeletionTombstone[];
}> {
  const allGroups = CC.group?.list?.all?.value ?? [];
  const scopedGroups = filterGroupsInScope(allGroups, opts.scope);
  const scopedTasks = filterTasksInScope(collectFlatTasks(), opts.scope);
  const changedTasks = filterTasksForSyncOutbound(scopedTasks, opts.peer ?? null, opts.sinceMs);
  const groupPayloads = await Promise.all(scopedGroups.map((g) => groupPayloadFromLocalAsync(g)));
  const changedGroups = filterGroupsForSyncOutbound(
    groupPayloads,
    opts.peer ?? null,
    opts.sinceMs,
  );
  const tasks = changedTasks.map((t) => taskPayloadFromFlat(t));
  const deletedTasks = await listTaskDeletionsForSync(opts.sinceMs, opts.scope);
  return { groups: changedGroups, tasks, deletedTasks };
}

/** Apply remote payload into in-memory organiser + persist. */
export async function applyInboundSyncDelta(
  remoteGroups: LanSyncExchangeRequest['groups'],
  remoteTasks: LanSyncExchangeRequest['tasks'],
  scope: Set<string>,
  remoteDeletedTasks?: LanSyncTaskDeletionPayload[],
): Promise<{ groupsApplied: number; tasksApplied: number; deletionsApplied: number }> {
  const deletions = await mergeRemoteTaskDeletions(remoteDeletedTasks);
  const localGroups = CC.group?.list?.all?.value ?? [];
  const mergedGroups = mergeGroupsById(localGroups, remoteGroups ?? []);
  await adoptMergedGroupBackgrounds(mergedGroups, remoteGroups);
  let localFlat = collectFlatTasks();
  localFlat = applyTaskDeletionsToFlatList(localFlat, deletions);
  const remoteInScope = filterTasksInScope(
    (remoteTasks ?? []) as FlatTask[],
    scope,
  ) as LanSyncExchangeRequest['tasks'];
  const mergedTasks = mergeTasksByNewest(localFlat, remoteInScope ?? []);

  if (CC.group?.list?.setGroups) {
    CC.group.list.setGroups(mergedGroups);
  }

  try {
    await withOrganiserSyncTriggerSuppressed(async () => {
      const days = (CC.task?.time?.days?.value ?? {}) as Record<
        string,
        { date: string; tasks: FlatTask[]; notes?: string }
      >;
      const nextDays = daysFromMergedTasks(days, mergedTasks);
      if (CC.task?.time?.days) {
        CC.task.time.days.value = nextDays;
      }
      refreshTaskFlatListFromDays();
      if (CC.storage?.saveData) {
        await CC.storage.saveData();
      }
    });
  } catch (e) {
    logger.error('[lanOrganiserSync] persist failed', e);
  }

  return {
    groupsApplied: (remoteGroups ?? []).length,
    tasksApplied: (remoteTasks ?? []).length,
    deletionsApplied: deletions.length,
  };
}

async function resolveContractForExchange(
  serverContract?: SyncContractSnapshot,
): Promise<SyncContractSnapshot | null> {
  const fromStore = await loadActiveContractForSync();
  if (fromStore) return fromStore;
  if (serverContract && Array.isArray(serverContract.devices)) {
    return serverContract;
  }
  return null;
}

function syncExchangeResponse(res: LanSyncExchangeResponse): LanSyncExchangeResponse {
  return toPlainLanSyncExchangeResponse(res);
}

/** Handle inbound HTTP sync exchange (renderer bridge). */
export async function handleLanSyncExchangeRequest(
  req: LanSyncExchangeRequest,
): Promise<LanSyncExchangeResponse> {
  const contract = await resolveContractForExchange(req.serverContract);
  if (!contract) {
    return syncExchangeResponse({
      ok: false,
      nextToken: LAN_SYNC_TOKEN_DISABLED,
      since: Date.now(),
      groups: [],
      tasks: [],
      error: 'no_contract',
    });
  }
  const scope = await resolveSyncScope(contract);
  let peer = await findSyncPeerState(req.deviceId);
  if (!peer) {
    peer = await ensurePeerSyncSession(req.deviceId, req.deviceId);
  }
  if (!isLanSyncTokenValid(peer.sessionToken, req.token)) {
    return syncExchangeResponse({
      ok: false,
      nextToken: peer.sessionToken,
      since: Date.now(),
      groups: [],
      tasks: [],
      error: 'invalid_token',
    });
  }

  const sinceMs =
    typeof req.since === 'number' && req.since > 0
      ? req.since
      : peer.lastSyncAt > 0
        ? peer.lastSyncAt
        : 0;

  if (req.groups?.length || req.tasks?.length || req.deletedTasks?.length) {
    await applyInboundSyncDelta(req.groups, req.tasks, scope, req.deletedTasks);
    peer = markSyncedFlags(peer, req.groups ?? [], req.tasks ?? [], req.deletedTasks ?? []);
  }

  const outbound = await buildOutboundSyncDelta({ sinceMs, scope, peer });
  peer = markSyncedFlags(peer, outbound.groups, outbound.tasks, outbound.deletedTasks);
  const nextToken = lanSyncExchangeNextToken();
  const now = Date.now();
  const peerPatch: Parameters<typeof upsertSyncPeerState>[0] = {
    ...adoptNextSyncToken(peer, nextToken),
    peerDeviceId: peer.peerDeviceId,
    lastSyncAt: now,
    lastSyncStatus: 'ok',
    groupSyncedAt: peer.groupSyncedAt,
    taskSyncedAt: peer.taskSyncedAt,
  };
  await upsertSyncPeerState(peerPatch);

  if (outbound.deletedTasks.length) {
    await pruneTaskDeletionTombstones(outbound.deletedTasks.map((d) => d.id));
  }

  return syncExchangeResponse({
    ok: true,
    nextToken,
    since: now,
    groups: outbound.groups,
    tasks: outbound.tasks,
    deletedTasks: outbound.deletedTasks,
  });
}

/** Initiator: sync with a paired peer over LAN (device id + token only; contract is local). */
export async function runSyncWithPeer(opts: {
  peerDeviceId: string;
  peerDeviceName: string;
  lanHost: string;
  sessionToken?: string;
}): Promise<boolean> {
  const contract = await loadActiveContractForSync();
  if (!contract) {
    logger.warn('[lanOrganiserSync] no active contract');
    return false;
  }
  const scope = await resolveSyncScope(contract);
  const local = await loadOwnDeviceMeta();
  let peer = await findSyncPeerState(opts.peerDeviceId);
  if (!peer) {
    peer = await ensurePeerSyncSession(opts.peerDeviceId, opts.peerDeviceName, opts.sessionToken);
  }
  const incremental = peer.lastSyncAt > 0;
  const run = await enqueueSyncRun({
    peerDeviceId: opts.peerDeviceId,
    peerDeviceName: opts.peerDeviceName,
    incremental,
  });
  await updateSyncRun(run.id, { status: 'running', startedAt: Date.now() });

  const base = co21LanBaseUrl(opts.lanHost);
  if (!base) {
    await updateSyncRun(run.id, {
      status: 'failed',
      finishedAt: Date.now(),
      message: 'invalid_host',
    });
    return false;
  }

  const sinceMs = incremental ? peer.lastSyncAt : 0;
  const outbound = await buildOutboundSyncDelta({ sinceMs, scope, peer });

  try {
    const reqBody: LanSyncExchangeRequest = {
      deviceId: local.id,
      token: peer.sessionToken,
      groups: outbound.groups,
      tasks: outbound.tasks,
      deletedTasks: outbound.deletedTasks,
    };
    if (sinceMs > 0) reqBody.since = sinceMs;
    const res = await lanPostSyncExchange(base, reqBody);
    if (!res?.ok) {
      await upsertSyncPeerState({
        peerDeviceId: opts.peerDeviceId,
        lastSyncStatus: 'failed',
        lastSyncMessage: res?.error ?? 'exchange_failed',
      });
      await updateSyncRun(run.id, {
        status: 'failed',
        finishedAt: Date.now(),
        message: res?.error ?? 'exchange_failed',
      });
      return false;
    }

    await applyInboundSyncDelta(res.groups, res.tasks, scope, res.deletedTasks);
    const synced = markSyncedFlags(
      peer,
      [...outbound.groups, ...res.groups],
      [...outbound.tasks, ...res.tasks],
      [...outbound.deletedTasks, ...(res.deletedTasks ?? [])],
    );
    const now = Date.now();
    await upsertSyncPeerState({
      peerDeviceId: opts.peerDeviceId,
      peerDeviceName: opts.peerDeviceName,
      sessionToken: adoptLanSyncNextToken(peer.sessionToken, res.nextToken),
      lastSyncAt: now,
      lastSyncStatus: 'ok',
      peerInRange: true,
      peerCheckedAt: now,
      groupSyncedAt: synced.groupSyncedAt,
      taskSyncedAt: synced.taskSyncedAt,
    });
    await updateSyncRun(run.id, {
      status: 'ok',
      finishedAt: now,
      groupsSent: outbound.groups.length,
      tasksSent: outbound.tasks.length,
      groupsReceived: res.groups.length,
      tasksReceived: res.tasks.length,
      message: incremental ? 'incremental' : 'full',
    });
    const prunedIds = [
      ...outbound.deletedTasks.map((d) => d.id),
      ...(res.deletedTasks ?? []).map((d) => d.id),
    ];
    if (prunedIds.length) await pruneTaskDeletionTombstones(prunedIds);
    return true;
  } catch (e) {
    logger.error('[lanOrganiserSync] runSyncWithPeer failed', e);
    await updateSyncRun(run.id, {
      status: 'failed',
      finishedAt: Date.now(),
      message: 'network_error',
    });
    await upsertSyncPeerState({
      peerDeviceId: opts.peerDeviceId,
      lastSyncStatus: 'failed',
      lastSyncMessage: 'network_error',
      peerInRange: false,
      peerCheckedAt: Date.now(),
    });
    return false;
  }
}

/** After contract accept: sync with all LAN peers that have a host. */
export async function runFirstSyncAfterContractAccept(
  sessionToken?: string,
): Promise<void> {
  const { loadConnectedDevices, mergeLocalDeviceIntoList } = await import('./deviceRoleAssignment');
  const local = await loadOwnDeviceMeta();
  const devices = mergeLocalDeviceIntoList(await loadConnectedDevices(), local);
  const remotes = devices.filter((d) => !d.isLocal && (d.lanHost || '').trim());
  const token = sessionToken?.trim() || undefined;

  for (const d of remotes) {
    await ensurePeerSyncSession(d.id, d.name, token);
    await runSyncWithPeer({
      peerDeviceId: d.id,
      peerDeviceName: d.name,
      lanHost: (d.lanHost || '').trim(),
      ...(token ? { sessionToken: token } : {}),
    });
  }
}
