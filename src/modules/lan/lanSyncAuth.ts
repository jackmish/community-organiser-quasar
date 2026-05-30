/**
 * Rotating LAN sync session token (one per paired peer, advanced on each exchange).
 * Set to `true` when re-enabling per-request token validation and rotation.
 */
export const LAN_SYNC_ROTATING_TOKEN_ENABLED = false;

/** Placeholder token while {@link LAN_SYNC_ROTATING_TOKEN_ENABLED} is off. */
export const LAN_SYNC_TOKEN_DISABLED = '';

import type { SyncContractSnapshot } from 'src/modules/storage/sync/syncContractSettings';

export type LanSyncExchangeRequest = {
  /** Caller device id (must be a trusted / paired peer). */
  deviceId: string;
  token: string;
  /** Set by Electron main when contract was just proposed (avoids renderer disk race). */
  serverContract?: SyncContractSnapshot;
  /** Client watermark (ms). Server returns entities with updatedAt > since. Omit for full contract scope. */
  since?: number;
  /** Outbound delta from caller (groups/tasks in contract scope). */
  groups?: LanSyncGroupPayload[];
  tasks?: LanSyncTaskPayload[];
  /** Task ids deleted since last sync (tombstones). */
  deletedTasks?: LanSyncTaskDeletionPayload[];
  /** Group ids removed since last sync (tombstones). */
  deletedGroups?: LanSyncGroupDeletionPayload[];
};

export type LanSyncTaskDeletionPayload = {
  id: string;
  deletedAt: string;
  groupId?: string;
};

export type LanSyncGroupDeletionPayload = {
  id: string;
  deletedAt: string;
};

export type LanSyncExchangeResponse = {
  ok: boolean;
  nextToken: string;
  /** Server watermark after this exchange (ms). */
  since: number;
  groups: LanSyncGroupPayload[];
  tasks: LanSyncTaskPayload[];
  deletedTasks?: LanSyncTaskDeletionPayload[];
  deletedGroups?: LanSyncGroupDeletionPayload[];
  error?: string;
};

export type LanSyncGroupPayload = {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  textColor?: string;
  backgroundImage?: string;
  layoutColorize?: boolean;
  backgroundColorize?: boolean;
  calendarColorize?: boolean;
  parentId?: string | null;
  hideTasksFromParent?: boolean;
  shareSubgroups?: boolean;
  shortcut?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type LanSyncTaskPayload = {
  id: string;
  groupId?: string;
  name?: string;
  description?: string;
  date?: string;
  eventDate?: string;
  status_id?: number | string;
  type_id?: string;
  type?: string;
  priority?: string;
  category?: string;
  eventTime?: string;
  tags?: string[];
  repeat?: Record<string, unknown> | null;
  timeMode?: string;
  timeOffsetDays?: number | null;
  color_set?: string | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export function isLanSyncTokenCheckEnabled(): boolean {
  return LAN_SYNC_ROTATING_TOKEN_ENABLED;
}

export function isLanSyncTokenValid(stored: string, provided: string): boolean {
  if (!LAN_SYNC_ROTATING_TOKEN_ENABLED) return true;
  return stored.trim() === provided.trim();
}

/** Token to send on the next exchange (after peer response). */
export function adoptLanSyncNextToken(_current: string, nextFromPeer: string): string {
  if (!LAN_SYNC_ROTATING_TOKEN_ENABLED) return LAN_SYNC_TOKEN_DISABLED;
  const next = nextFromPeer.trim();
  return next || createLanSyncToken();
}

/** Token to return to peer after handling an inbound exchange. */
export function lanSyncExchangeNextToken(): string {
  if (!LAN_SYNC_ROTATING_TOKEN_ENABLED) return LAN_SYNC_TOKEN_DISABLED;
  return createLanSyncToken();
}

export function createLanSyncToken(): string {
  if (!LAN_SYNC_ROTATING_TOKEN_ENABLED) return LAN_SYNC_TOKEN_DISABLED;
  return crypto.randomUUID();
}

/** Electron `executeJavaScript` / IPC cannot clone Vue proxies — plain JSON only. */
export function toPlainLanSyncExchangeResponse(res: LanSyncExchangeResponse): LanSyncExchangeResponse {
  return JSON.parse(JSON.stringify(res)) as LanSyncExchangeResponse;
}
