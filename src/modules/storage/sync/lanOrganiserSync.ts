import CC from 'src/CCAccess';
import { co21LanBaseUrl } from 'src/modules/lan/lanPairingConstants';
import type {
  LanSyncExchangeRequest,
  LanSyncExchangeResponse,
} from 'src/modules/lan/lanSyncAuth';
import { createLanSyncToken } from 'src/modules/lan/lanSyncAuth';
import { lanPostSyncExchange } from 'src/modules/lan/lanSyncTransport';
import { loadActiveContractForSync } from './syncContractSettings';
import { contractGroupIds } from './syncContractScope';
import {
  groupPayloadFromLocal,
  mergeGroupsById,
  mergeTasksByNewest,
  taskPayloadFromFlat,
  type FlatTask,
} from './organiserLanMerge';
import {
  adoptNextSyncToken,
  ensurePeerSyncSession,
  findSyncPeerState,
  upsertSyncPeerState,
  type SyncPeerRecord,
} from './syncPeerState';
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

function taskDateKey(t: FlatTask): string {
  const raw = asOptionalString(t.date) || asOptionalString(t.eventDate);
  return raw.slice(0, 10) || new Date().toISOString().slice(0, 10);
}

function collectFlatTasks(): FlatTask[] {
  const out: FlatTask[] = [];
  try {
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

function filterBySince<T extends { updatedAt?: string }>(rows: T[], sinceMs: number): T[] {
  if (!sinceMs) return rows;
  return rows.filter((r) => tsMs(r.updatedAt) > sinceMs);
}

function markSyncedFlags(
  peer: SyncPeerRecord,
  groups: { id: string; updatedAt?: string }[],
  tasks: { id: string; updatedAt?: string }[],
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
  return { ...peer, groupSyncedAt, taskSyncedAt };
}

/** Build outbound delta for contract-scoped groups/tasks. */
export function buildOutboundSyncDelta(opts: {
  sinceMs: number;
  scope: Set<string>;
}): { groups: ReturnType<typeof groupPayloadFromLocal>[]; tasks: ReturnType<typeof taskPayloadFromFlat>[] } {
  const allGroups = CC.group?.list?.all?.value ?? [];
  const scopedGroups = filterGroupsInScope(allGroups, opts.scope);
  const scopedTasks = filterTasksInScope(collectFlatTasks(), opts.scope);
  const groups = filterBySince(
    scopedGroups.map((g) => groupPayloadFromLocal(g)),
    opts.sinceMs,
  );
  const tasks = filterBySince(scopedTasks.map((t) => taskPayloadFromFlat(t)), opts.sinceMs);
  return { groups, tasks };
}

/** Apply remote payload into in-memory organiser + persist. */
export async function applyInboundSyncDelta(
  remoteGroups: LanSyncExchangeRequest['groups'],
  remoteTasks: LanSyncExchangeRequest['tasks'],
  scope: Set<string>,
): Promise<{ groupsApplied: number; tasksApplied: number }> {
  const localGroups = CC.group?.list?.all?.value ?? [];
  const mergedGroups = mergeGroupsById(localGroups, remoteGroups ?? []);
  const mergedTasks = mergeTasksByNewest(collectFlatTasks(), remoteTasks ?? []);
  const scopedTaskIds = new Set(
    filterTasksInScope(mergedTasks, scope).map((t) => String(t.id)),
  );

  if (CC.group?.list?.setGroups) {
    CC.group.list.setGroups(mergedGroups);
  }

  try {
    const days = CC.task?.time?.days?.value ?? {};
    const byDate: Record<string, { date: string; tasks: FlatTask[]; notes?: string }> = {};
    for (const t of mergedTasks) {
      if (!scopedTaskIds.has(String(t.id))) continue;
      const dateKey = taskDateKey(t);
      if (!byDate[dateKey]) byDate[dateKey] = { date: dateKey, tasks: [], notes: '' };
      byDate[dateKey].tasks.push(t);
    }
    if (CC.task?.time?.days) {
      CC.task.time.days.value = { ...days, ...byDate };
    }
    if (CC.storage?.saveData) {
      await CC.storage.saveData();
    }
  } catch (e) {
    logger.error('[lanOrganiserSync] persist failed', e);
  }

  return {
    groupsApplied: (remoteGroups ?? []).length,
    tasksApplied: (remoteTasks ?? []).length,
  };
}

/** Handle inbound HTTP sync exchange (renderer bridge). */
export async function handleLanSyncExchangeRequest(
  req: LanSyncExchangeRequest,
): Promise<LanSyncExchangeResponse> {
  const contract = await loadActiveContractForSync();
  if (!contract) {
    return { ok: false, nextToken: req.token, since: Date.now(), groups: [], tasks: [], error: 'no_contract' };
  }
  const scope = contractGroupIds(contract);
  let peer = await findSyncPeerState(req.deviceId);
  if (!peer) {
    peer = await ensurePeerSyncSession(req.deviceId, req.deviceId);
  }
  if (peer.sessionToken !== req.token) {
    return {
      ok: false,
      nextToken: peer.sessionToken,
      since: Date.now(),
      groups: [],
      tasks: [],
      error: 'invalid_token',
    };
  }

  const sinceMs =
    typeof req.since === 'number' && req.since > 0
      ? req.since
      : peer.lastSyncAt > 0
        ? peer.lastSyncAt
        : 0;

  if (req.groups?.length || req.tasks?.length) {
    await applyInboundSyncDelta(req.groups, req.tasks, scope);
    peer = markSyncedFlags(peer, req.groups ?? [], req.tasks ?? []);
  }

  const outbound = buildOutboundSyncDelta({ sinceMs, scope });
  const nextToken = createLanSyncToken();
  const now = Date.now();
  const peerPatch: Parameters<typeof upsertSyncPeerState>[0] = {
    ...adoptNextSyncToken(peer, nextToken),
    peerDeviceId: peer.peerDeviceId,
    lastSyncAt: now,
    lastSyncStatus: 'ok',
  };
  await upsertSyncPeerState(peerPatch);

  return {
    ok: true,
    nextToken,
    since: now,
    groups: outbound.groups,
    tasks: outbound.tasks,
  };
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
  const scope = contractGroupIds(contract);
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
  const outbound = buildOutboundSyncDelta({ sinceMs, scope });

  try {
    const reqBody: LanSyncExchangeRequest = {
      deviceId: local.id,
      token: peer.sessionToken,
      groups: outbound.groups,
      tasks: outbound.tasks,
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

    await applyInboundSyncDelta(res.groups, res.tasks, scope);
    const now = Date.now();
    await upsertSyncPeerState({
      peerDeviceId: opts.peerDeviceId,
      peerDeviceName: opts.peerDeviceName,
      sessionToken: res.nextToken,
      lastSyncAt: now,
      lastSyncStatus: 'ok',
      peerInRange: true,
      peerCheckedAt: now,
      groupSyncedAt: markSyncedFlags(peer, outbound.groups, outbound.tasks).groupSyncedAt,
      taskSyncedAt: markSyncedFlags(peer, outbound.groups, outbound.tasks).taskSyncedAt,
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
