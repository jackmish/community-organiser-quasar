/**
 * CapacitorBackend — persistence layer for Capacitor (iOS / Android) builds.
 *
 * Status: STUB — all methods are outlined with TODOs.
 *         Implement when the mobile Capacitor target is ready.
 *
 * Capacitor provides two main storage primitives:
 *  - @capacitor/filesystem  — read/write files in the app sandbox (like Electron's fs)
 *  - @capacitor/preferences — key/value store backed by SharedPreferences (Android)
 *                             or UserDefaults (iOS); analogous to localStorage
 *
 * Recommended approach:
 *  - Groups → individual JSON files via Filesystem API  (mirrors ElectronBackend)
 *  - Settings → Preferences API (simple key/value, survives app updates)
 *
 * Installation (when ready):
 *   npm install @capacitor/filesystem @capacitor/preferences
 *   npx cap sync
 */

import type { StorageBackend, OrganiserData } from '../StorageBackend';
import type { Group } from '../../../group/models/GroupModel';
import logger from '../../../../utils/logger';

// TODO: uncomment when @capacitor/filesystem and @capacitor/preferences are installed
// import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
// import { Preferences } from '@capacitor/preferences';

/** Sub-directory within the app's data folder where group files are stored. */
const GROUP_SUBDIR = 'storage/group';

/** Key used in Preferences for the settings blob. */
const SETTINGS_KEY = 'day-organiser-settings';

export class CapacitorBackend implements StorageBackend {
  readonly name = 'capacitor';

  /**
   * Returns true when running inside a Capacitor WebView context.
   * `window.Capacitor` is injected by the Capacitor bridge.
   */
  isAvailable(): boolean {
    // TODO: verify this detection works on both Android and iOS.
    return typeof window !== 'undefined' && !!(window as any).Capacitor;
  }

  // ── Groups ─────────────────────────────────────────────────────────────────

  async loadAllGroups(): Promise<Group[]> {
    // TODO: implement using Filesystem.readdir / Filesystem.readFile
    //
    // Rough steps:
    //   1. const { files } = await Filesystem.readdir({
    //        path: GROUP_SUBDIR,
    //        directory: Directory.Data,
    //      });
    //   2. Filter for files matching /^group-.+\.json$/
    //   3. For each file: read → JSON.parse → push to groups[]
    //   4. Return groups
    //
    // Handle ENOENT (directory not yet created) by returning [].
    logger.warn('[CapacitorBackend] loadAllGroups not implemented');
    return [];
  }

  async saveGroups(groups: Group[]): Promise<void> {
    // TODO: implement using Filesystem.writeFile
    //
    // Rough steps:
    //   1. Ensure GROUP_SUBDIR exists (mkdir -p equivalent via Filesystem)
    //   2. For each group, build filename `group-${group.id}.json`
    //   3. Filesystem.writeFile({ path, data: JSON.stringify(group, safeReplacer, 2),
    //        directory: Directory.Data, encoding: Encoding.UTF8 })
    //
    // See electronBackend.saveGroupsToFiles for the safe JSON serialiser
    // (it strips underscore-prefixed keys and circular refs).
    logger.warn('[CapacitorBackend] saveGroups not implemented');
  }

  async deleteGroup(groupId: string): Promise<void> {
    // TODO: implement using Filesystem.deleteFile
    //
    //   const path = `${GROUP_SUBDIR}/group-${groupId}.json`;
    //   await Filesystem.deleteFile({ path, directory: Directory.Data });
    //
    // Swallow ENOENT so deleting a non-existent group is a no-op.
    logger.warn('[CapacitorBackend] deleteGroup not implemented');
  }

  // ── Settings ───────────────────────────────────────────────────────────────

  async loadSettings(): Promise<Record<string, any>> {
    // TODO: implement using Preferences.get
    //
    //   const { value } = await Preferences.get({ key: SETTINGS_KEY });
    //   return value ? JSON.parse(value) : {};
    //
    // Alternatively, store settings as a JSON file via Filesystem so that
    // export/import picks them up automatically (same as ElectronBackend).
    logger.warn('[CapacitorBackend] loadSettings not implemented');
    return {};
  }

  async saveSettings(settings: Record<string, any>): Promise<void> {
    // TODO: implement using Preferences.set
    //
    //   await Preferences.set({ key: SETTINGS_KEY, value: JSON.stringify(settings) });
    logger.warn('[CapacitorBackend] saveSettings not implemented');
  }

  async getSetting(key: string, defaultValue: any = undefined): Promise<any> {
    // TODO: load settings blob and return settings[key] ?? defaultValue
    // Can delegate to: const s = await this.loadSettings(); return s[key] ?? defaultValue;
    try {
      const s = await this.loadSettings();
      return Object.prototype.hasOwnProperty.call(s, key) ? s[key] : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  async setSetting(key: string, value: any): Promise<void> {
    // TODO: load → merge → save
    // const s = await this.loadSettings(); s[key] = value; await this.saveSettings(s);
    try {
      const s = await this.loadSettings();
      s[key] = value;
      await this.saveSettings(s);
    } catch (e) {
      logger.error('[CapacitorBackend] setSetting failed', e);
    }
  }

  // ── Import / Export ────────────────────────────────────────────────────────

  async importFromFile(file: File): Promise<OrganiserData> {
    // TODO: Capacitor doesn't have direct file picker access on all platforms.
    //
    // Options:
    //  A) Use the standard browser File API (works in Capacitor WebView too) —
    //     copy the logic from ElectronBackend.importFromFile (FileReader + fflate).
    //  B) Use @capacitor/filesystem with a URI returned by a native file picker
    //     plugin (e.g. capacitor-community/file-picker).
    //
    // For now, fall back to the browser FileReader path used in the web build.
    //
    // Fallback copyed from ElectronBackend (browser path only):
    return new Promise<OrganiserData>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          resolve(JSON.parse(e.target?.result as string));
        } catch {
          reject(new Error('Invalid JSON file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  exportToFile(data: OrganiserData): void {
    // TODO: implement a native share / save dialog.
    //
    // Options:
    //  A) Browser download link — works in Capacitor WebView but saves to Downloads,
    //     not the most native UX.
    //  B) Write to a temp file via Filesystem, then trigger Share via @capacitor/share:
    //       await Filesystem.writeFile({ path: 'export.json', data: JSON.stringify(data), ... });
    //       const { uri } = await Filesystem.getUri({ path: 'export.json', directory: ... });
    //       await Share.share({ files: [uri] });
    logger.warn('[CapacitorBackend] exportToFile not implemented', data);
  }

  // ── Diagnostics ────────────────────────────────────────────────────────────

  async getStoragePath(): Promise<string> {
    // TODO: return the resolved URI for the data directory so users can see
    // where files are stored (useful in a debug / about screen).
    //
    //   const { uri } = await Filesystem.getUri({ path: GROUP_SUBDIR, directory: Directory.Data });
    //   return uri;
    return GROUP_SUBDIR;
  }
}

export const capacitorStorage = new CapacitorBackend();
