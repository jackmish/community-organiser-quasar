/**
 * DeviceId — persistent unique identifier for this installation.
 *
 * One ID per device/installation, generated once and stored in settings.
 * Used as the author field in every ChangeEntry so sync can attribute
 * and deduplicate changes by source device.
 *
 * Usage:
 *   import { deviceId } from 'src/modules/storage/sync/deviceId';
 *   deviceId.init(getSetting, setSetting);   // once at app boot
 *   const id = await deviceId.get();
 */

import logger from '../../../utils/logger';

type SettingsReader = (key: string, fallback: string) => Promise<string>;
type SettingsWriter = (key: string, value: string) => Promise<void>;

export class DeviceId {
  private readonly SETTING_KEY = 'deviceId';
  private _cached: string | null = null;
  private _read: SettingsReader = async () => '';
  private _write: SettingsWriter = async () => {};

  // ── Initialisation ────────────────────────────────────────────────────────

  /**
   * Inject the settings accessors on app boot.
   * Call this once before any sync code runs.
   *
   * Example:
   *   import { deviceId } from 'src/modules/storage/sync/deviceId';
   *   deviceId.init(getSetting, setSetting);
   */
  init(reader: SettingsReader, writer: SettingsWriter): void {
    this._read = reader;
    this._write = writer;
    this._cached = null; // reset cache so next get() re-reads
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Return the persistent device ID, creating and saving it if absent.
   * Result is cached in memory for the lifetime of the session.
   */
  async get(): Promise<string> {
    if (this._cached) return this._cached;

    try {
      const stored = await this._read(this.SETTING_KEY, '');
      if (stored) {
        this._cached = stored;
        return this._cached;
      }
    } catch (e) {
      logger.warn('[deviceId] failed to read stored deviceId', e);
    }

    const newId = crypto.randomUUID();
    logger.info('[deviceId] generated new deviceId', newId);

    try {
      await this._write(this.SETTING_KEY, newId);
    } catch (e) {
      logger.warn('[deviceId] failed to persist deviceId', e);
      // Continue with the in-memory ID for this session.
    }

    this._cached = newId;
    return this._cached;
  }

  /**
   * Override the device ID (useful in tests or when the user explicitly sets
   * a human-readable device label via settings UI).
   */
  async set(id: string): Promise<void> {
    this._cached = id;
    await this._write(this.SETTING_KEY, id);
  }

  /** Synchronous read of the cached value — only valid after the first await get(). */
  getSync(): string | null {
    return this._cached;
  }

  /** Reset cache (for tests). */
  _resetCache(): void {
    this._cached = null;
  }
}

export const deviceId = new DeviceId();
