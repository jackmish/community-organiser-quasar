/**
 * DeviceProfile — a record describing one known remote device in the sync network.
 *
 * Two name fields exist intentionally:
 *  - `remoteName`  — the name the remote device advertises over BLE / P2P.
 *                    Written once on first sync, refreshed on each subsequent sync.
 *                    The user cannot edit this; it is "what the device calls itself".
 *  - `alias`       — an optional user-defined label for this device on the local
 *                    installation only (e.g. "Mom's laptop", "Office PC").
 *                    Displayed in preference to `remoteName` when set.
 *
 * `syncVector` stores the last-known sync position for this device so that the
 * next sync only sends the delta (entries the remote hasn't seen yet) rather than
 * the full log.  Reset to {} to force a full re-sync.
 */

import { BaseModel } from '../../../types/BaseModel';
import type { SyncVector } from './ChangeEntry';

export type DeviceTransport = 'bluetooth' | 'p2p' | 'rest' | 'unknown';

export type DeviceTrustStatus =
  | 'trusted' // actively syncing
  | 'pending' // seen but not yet accepted
  | 'blocked'; // user has blocked this device

/**
 * Access level this device has been granted for a specific group.
 *
 *  view  — device receives data from this group (read-only pull)
 *  sync  — bidirectional: device can push and pull changes to/from this group
 *  admin — sync + can invite other devices into the group
 */
export type GroupPrivilege = 'view' | 'sync' | 'admin';

/**
 * One group membership entry attached to a DeviceProfile.
 * Many GroupLinks can be attached to a single profile.
 */
export interface GroupLink {
  /** ID of the GroupModel the remote device is granted access to. */
  groupId: string;
  /** Access level granted for that group. */
  privilege: GroupPrivilege;
  /** ISO-8601 timestamp when the link was created locally. */
  addedAt: string;
}

export class DeviceProfile extends BaseModel {
  /** Stable UUID from the remote's deviceId system — the real identity key. */
  remoteDeviceId: string;

  /** Name the remote device sent during its last announce/handshake. */
  remoteName: string;

  /** User's local label for this device. Empty string means "use remoteName". */
  alias: string;

  /** ISO-8601 timestamp of the last successful sync with this device. */
  lastSeen: string | null;

  /** Transport channel used most recently. */
  transport: DeviceTransport;

  /** Trust level — determines whether sync is allowed automatically. */
  trustStatus: DeviceTrustStatus;

  /**
   * Last known sync vector for this device.
   * Used by SyncEngine to build delta payloads efficiently.
   * {} means we've never synced → next sync sends the full log.
   */
  syncVector: SyncVector;

  /**
   * Groups this device profile has been granted access to.
   * Each entry pairs a group ID with a privilege level.
   * Multiple groups can be linked to the same profile.
   */
  groupLinks: GroupLink[];

  constructor(init: {
    id?: string;
    createdAt?: string;
    updatedAt?: string;
    remoteDeviceId: string;
    remoteName: string;
    alias?: string;
    lastSeen?: string | null;
    transport?: DeviceTransport;
    trustStatus?: DeviceTrustStatus;
    syncVector?: SyncVector;
    groupLinks?: GroupLink[];
  }) {
    super(init);
    this.remoteDeviceId = init.remoteDeviceId;
    this.remoteName = init.remoteName;
    this.alias = init.alias ?? '';
    this.lastSeen = init.lastSeen ?? null;
    this.transport = init.transport ?? 'unknown';
    this.trustStatus = init.trustStatus ?? 'pending';
    this.syncVector = init.syncVector ?? {};
    this.groupLinks = init.groupLinks ?? [];
  }

  /** The name to show in the UI — alias takes priority over remoteName. */
  get displayName(): string {
    return this.alias.trim() || this.remoteName;
  }
}
