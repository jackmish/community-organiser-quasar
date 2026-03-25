/**
 * StorageBackend — shared interface every persistence back-end must implement.
 *
 * Three concrete implementations are planned:
 *  - ElectronBackend   (desktop)  backend/electron/electronBackend.ts  ← already working
 *  - CapacitorBackend  (mobile)   backend/mobile/capacitorBackend.ts   ← stub / TODO
 *  - RestApiBackend    (web/PWA)   backend/server/restApiBackend.ts     ← stub / TODO
 *
 * ─── How Pinia could fit in ──────────────────────────────────────────────────
 *
 *  Right now every call to load groups or settings hits the file system (or the
 *  REST endpoint) directly.  That means multiple components that read the same
 *  setting have to await IO instead of a reactive ref.
 *
 *  A thin Pinia store sitting *in front of* this interface would give us:
 *
 *  1. Reactive cache — after the first load, components receive `groups` and
 *     `settings` as reactive Pinia state; there is no extra IO.
 *
 *  2. Single source of truth — any mutation (save / delete) goes through the
 *     store action, which:   (a) calls the active StorageBackend to persist,
 *                            (b) updates the in-memory state so subscribers
 *                                react immediately — no manual refresh.
 *
 *  3. Backend-agnostic — the store holds a reference to the currently active
 *     StorageBackend (chosen at boot time).  Swapping Electron → Capacitor →
 *     REST just means assigning a different implementation; all components are
 *     unaffected.
 *
 *  4. Devtools / time-travel — Pinia DevTools let you inspect and replay state
 *     mutations for free, which is very useful during development.
 *
 *  Suggested store shape (pseudocode):
 *
 *    const useStorageStore = defineStore('storage', () => {
 *      const backend = ref<StorageBackend>(activeBackend);   // injected at boot
 *      const groups   = ref<Group[]>([]);
 *      const settings = ref<Record<string, any>>({});
 *
 *      async function loadGroups()   { groups.value   = await backend.value.loadAllGroups(); }
 *      async function saveGroups(gs) { await backend.value.saveGroups(gs); groups.value = gs; }
 *      async function loadSettings() { settings.value = await backend.value.loadSettings();  }
 *      // … etc.
 *      return { groups, settings, loadGroups, saveGroups, loadSettings };
 *    });
 *
 *  NOTE: Pinia is already installed (see boot/pinia.ts).  It is not yet used in
 *  a meaningful way, but this storage layer is the most natural first use-case.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Group } from '../../group/models/GroupModel';
import type { DayData } from '../../task/models/classes/DayData';

// ---------------------------------------------------------------------------
// Shared data shape (previously only in electronBackend.ts)
// ---------------------------------------------------------------------------

export interface OrganiserData {
  days: Record<string, DayData>;
  groups: Group[];
  lastModified: string;
}

// ---------------------------------------------------------------------------
// The contract every backend must satisfy
// ---------------------------------------------------------------------------

/**
 * StorageBackend describes the minimal API a persistence back-end must expose.
 *
 * Rules for implementors:
 *  - Every method may throw; callers should wrap in try/catch.
 *  - `isAvailable()` MUST return synchronously (used before async init).
 *  - `getSetting / setSetting` are convenience wrappers; a backend that stores
 *    settings as a single blob must load/merge internally.
 */
export interface StorageBackend {
  /**
   * Human-readable name used in logs and debug UI (e.g. "electron", "capacitor").
   */
  readonly name: string;

  /**
   * Synchronous check — can this backend operate in the current environment?
   * E.g. ElectronBackend returns `!!window.electronAPI`.
   */
  isAvailable(): boolean;

  // ── Groups ───────────────────────────────────────────────────────────────

  /** Load all persisted groups (with their embedded tasks). */
  loadAllGroups(): Promise<Group[]>;

  /** Persist the full groups array (replace all). */
  saveGroups(groups: Group[]): Promise<void>;

  /** Remove the persisted data for a single group by its id. */
  deleteGroup(groupId: string): Promise<void>;

  // ── Settings ─────────────────────────────────────────────────────────────

  /** Load the full settings object. Returns `{}` when nothing is stored. */
  loadSettings(): Promise<Record<string, any>>;

  /** Overwrite the full settings object. */
  saveSettings(settings: Record<string, any>): Promise<void>;

  /** Read a single key; returns `defaultValue` when missing. */
  getSetting(key: string, defaultValue?: any): Promise<any>;

  /** Write a single key without touching others. */
  setSetting(key: string, value: any): Promise<void>;

  // ── Import / Export ───────────────────────────────────────────────────────

  /**
   * Parse a File (JSON or ZIP) into OrganiserData.
   * Used by the import dialog — the actual file reading lives here so each
   * backend can decide whether to use the FileReader API or a native API.
   */
  importFromFile(file: File): Promise<OrganiserData>;

  /**
   * Trigger an export / download of the given data.
   * Implementation detail (download link, native save-dialog, etc.) is left
   * to the specific backend.
   */
  exportToFile(data: OrganiserData): void;

  // ── Diagnostics ──────────────────────────────────────────────────────────

  /**
   * Return a human-readable path / URL that indicates where data is stored.
   * Used in settings UI and log messages.  Returns empty string if not applicable.
   */
  getStoragePath(): Promise<string>;
}
