/**
 * DeviceRegistry — manages the list of known remote devices.
 *
 * Responsibilities:
 *  - Load and save the DeviceProfile list from/to settings storage.
 *  - CRUD operations (add, update, remove, find).
 *  - Record the latest remoteName and syncVector after each sync without
 *    overwriting the user's alias.
 *
 * Usage:
 *   import { deviceRegistry } from 'src/modules/storage/sync/DeviceRegistry';
 *   await deviceRegistry.init(getSetting, setSetting);
 *   const all = deviceRegistry.getAll();
 */

import logger from '../../../utils/logger';
import { DeviceProfile } from './DeviceProfile';
import type { DeviceTransport, DeviceTrustStatus } from './DeviceProfile';
import type { SyncVector } from './ChangeEntry';

type SettingsReader = (key: string, fallback: string) => Promise<string>;
type SettingsWriter = (key: string, value: string) => Promise<void>;

const STORAGE_KEY = 'deviceProfiles';

export class DeviceRegistry {
  private _profiles: DeviceProfile[] = [];
  private _read: SettingsReader = async () => '';
  private _write: SettingsWriter = async () => {};
  private _loaded = false;

  // ── Initialisation ────────────────────────────────────────────────────────

  /**
   * Inject storage accessors and load saved profiles.
   * Call once at app boot before any sync code runs.
   */
  async init(reader: SettingsReader, writer: SettingsWriter): Promise<void> {
    this._read = reader;
    this._write = writer;
    await this._load();
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** All known device profiles, in insertion order. */
  getAll(): DeviceProfile[] {
    return [...this._profiles];
  }

  /** Find a profile by its local id. */
  findById(id: string): DeviceProfile | undefined {
    return this._profiles.find((p) => p.id === id);
  }

  /** Find a profile by the remote device's actual UUID. */
  findByRemoteDeviceId(remoteDeviceId: string): DeviceProfile | undefined {
    return this._profiles.find((p) => p.remoteDeviceId === remoteDeviceId);
  }

  /**
   * Add a new device profile.
   * No-op (returns existing) if a profile with the same remoteDeviceId exists.
   */
  async add(profile: DeviceProfile): Promise<DeviceProfile> {
    const existing = this.findByRemoteDeviceId(profile.remoteDeviceId);
    if (existing) return existing;

    this._profiles = [...this._profiles, profile];
    await this._save();
    logger.info('[DeviceRegistry] added device', profile.remoteDeviceId, profile.remoteName);
    return profile;
  }

  /**
   * Update mutable fields on an existing profile.
   * Only the fields present in `changes` are applied; others are untouched.
   */
  async update(
    id: string,
    changes: Partial<
      Pick<
        DeviceProfile,
        | 'alias'
        | 'remoteName'
        | 'lastSeen'
        | 'transport'
        | 'trustStatus'
        | 'syncVector'
        | 'groupLinks'
      >
    >,
  ): Promise<void> {
    const idx = this._profiles.findIndex((p) => p.id === id);
    if (idx === -1) {
      logger.warn('[DeviceRegistry] update called on unknown id', id);
      return;
    }

    const updated = Object.assign(Object.create(DeviceProfile.prototype), {
      ...this._profiles[idx],
      ...changes,
      updatedAt: new Date().toISOString(),
    }) as DeviceProfile;

    this._profiles = [...this._profiles.slice(0, idx), updated, ...this._profiles.slice(idx + 1)];
    await this._save();
  }

  /**
   * Called after a successful sync to record the remote's latest advertised
   * name and the updated sync vector, WITHOUT touching the user's alias.
   */
  async recordSync(
    remoteDeviceId: string,
    remoteName: string,
    syncVector: SyncVector,
    transport: DeviceTransport,
  ): Promise<void> {
    const profile = this.findByRemoteDeviceId(remoteDeviceId);
    if (!profile) {
      logger.warn('[DeviceRegistry] recordSync: unknown device', remoteDeviceId);
      return;
    }
    await this.update(profile.id, {
      remoteName,
      syncVector,
      transport,
      lastSeen: new Date().toISOString(),
      trustStatus: 'trusted',
    });
  }

  /** Remove a profile permanently. */
  async remove(id: string): Promise<void> {
    const before = this._profiles.length;
    this._profiles = this._profiles.filter((p) => p.id !== id);
    if (this._profiles.length < before) {
      await this._save();
      logger.info('[DeviceRegistry] removed device', id);
    }
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  private async _load(): Promise<void> {
    try {
      const raw = await this._read(STORAGE_KEY, '[]');
      const parsed: unknown[] = JSON.parse(raw);
      this._profiles = parsed.map(
        (p) => Object.assign(Object.create(DeviceProfile.prototype), p) as DeviceProfile,
      );
      this._loaded = true;
      logger.debug('[DeviceRegistry] loaded', this._profiles.length, 'profiles');
    } catch (e) {
      logger.warn('[DeviceRegistry] failed to load profiles, starting empty', e);
      this._profiles = [];
      this._loaded = true;
    }
  }

  private async _save(): Promise<void> {
    try {
      await this._write(STORAGE_KEY, JSON.stringify(this._profiles));
    } catch (e) {
      logger.warn('[DeviceRegistry] failed to save profiles', e);
    }
  }

  get isLoaded(): boolean {
    return this._loaded;
  }
}

export const deviceRegistry = new DeviceRegistry();
