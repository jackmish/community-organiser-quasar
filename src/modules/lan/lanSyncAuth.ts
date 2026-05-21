/** Rotating LAN sync session token (one per paired peer, advanced on each exchange). */

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
};

export type LanSyncExchangeResponse = {
  ok: boolean;
  nextToken: string;
  /** Server watermark after this exchange (ms). */
  since: number;
  groups: LanSyncGroupPayload[];
  tasks: LanSyncTaskPayload[];
  error?: string;
};

export type LanSyncGroupPayload = {
  id: string;
  name: string;
  color?: string;
  icon?: string;
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

export function createLanSyncToken(): string {
  return crypto.randomUUID();
}
