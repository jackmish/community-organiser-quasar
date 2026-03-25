/**
 * deviceId — persistent unique identifier for this installation.
 *
 * One ID per device/installation, generated once and stored in settings.
 * Used as the author field in every ChangeEntry so that sync can attribute
 * and deduplicate changes by source device.
 *
 * When multi-user (not just multi-device) is needed later, this becomes
 * the "session identity" and a user layer can be added on top.
 */

import logger from '../../../utils/logger';

const SETTING_KEY = 'deviceId';

// Lazy in-memory cache so settings IO only happens once per session.
let _cached: string | null = null;

// ---------------------------------------------------------------------------
// Internal helpers — kept separate so tests can inject a mock getSetting
// ---------------------------------------------------------------------------

type SettingsReader = (key: string, fallback: string) => Promise<string>;
type SettingsWriter = (key: string, value: string) => Promise<void>;

let _read: SettingsReader = async () => '';
let _write: SettingsWriter = async () => {};

/**
 * Inject the settings accessors on app boot.
 * Call this once from apiRoot / boot before any sync code runs.
 *
 * Example:
 *   import { initDeviceId } from 'src/modules/storage/sync/deviceId';
 *   import { getSetting, setSetting } from 'src/modules/storage/backend/electron/electronBackend';
 *   initDeviceId(getSetting, setSetting);
 */
export function initDeviceId(reader: SettingsReader, writer: SettingsWriter): void {
  _read = reader;
  _write = writer;
  _cached = null; // reset cache so next getDeviceId() re-reads
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return the persistent device ID, creating and saving it if absent.
 * Result is cached in memory for the lifetime of the session.
 */
export async function getDeviceId(): Promise<string> {
  if (_cached) return _cached;

  try {
    const stored = await _read(SETTING_KEY, '');
    if (stored) {
      _cached = stored;
      return _cached;
    }
  } catch (e) {
    logger.warn('[deviceId] failed to read stored deviceId', e);
  }

  const newId = crypto.randomUUID();
  logger.info('[deviceId] generated new deviceId', newId);

  try {
    await _write(SETTING_KEY, newId);
  } catch (e) {
    logger.warn('[deviceId] failed to persist deviceId', e);
    // Continue with the in-memory ID for this session.
  }

  _cached = newId;
  return _cached;
}

/**
 * Override the device ID (useful in tests or when the user explicitly sets
 * a human-readable device label via settings UI).
 */
export async function setDeviceId(id: string): Promise<void> {
  _cached = id;
  await _write(SETTING_KEY, id);
}

/** Synchronous read of the cached value — only valid after the first await getDeviceId(). */
export function getDeviceIdSync(): string | null {
  return _cached;
}

/** Reset cache (for tests). */
export function _resetCache(): void {
  _cached = null;
}
