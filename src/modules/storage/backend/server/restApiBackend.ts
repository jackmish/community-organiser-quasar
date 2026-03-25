/**
 * RestApiBackend — persistence layer that talks to a remote HTTP/REST server.
 *
 * Status: STUB — all methods are outlined with TODOs.
 *         Implement when the backend API server is ready.
 *
 * Intended use-cases:
 *  - Progressive Web App (PWA) build served from a domain
 *  - Any build where a central server is available (team / shared data)
 *
 * Design notes:
 *  - All reads/writes go through fetch() to a configurable base URL.
 *  - Authentication (JWT, session cookie, API key …) is intentionally left as
 *    a TODO — pick whatever the server uses.
 *  - Because network calls can fail, every method should have clear error
 *    handling and optionally an offline fallback (e.g. Pinia cache replay).
 *
 * Suggested API surface (adapt to match the actual server routes):
 *
 *   GET    /api/groups          → Group[]
 *   PUT    /api/groups          → save all groups (full replace)
 *   DELETE /api/groups/:id      → delete one group
 *   GET    /api/settings        → Record<string, any>
 *   PUT    /api/settings        → save settings
 *   POST   /api/import          → multipart upload → OrganiserData
 *   GET    /api/export          → triggers a file download
 *
 * ─── Pinia integration opportunity ──────────────────────────────────────────
 *
 *  For the REST backend, Pinia is especially useful as an optimistic-update
 *  cache:
 *
 *  1. Before the first API call resolves, show cached Pinia state (no spinner).
 *  2. Mutate Pinia state immediately on user actions (optimistic), then sync to
 *     server in background; roll back on error.
 *  3. A Pinia plugin (e.g. pinia-plugin-persistedstate) can mirror the store to
 *     localStorage so the app works offline and re-syncs when connectivity
 *     is restored.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { StorageBackend, OrganiserData } from '../StorageBackend';
import type { Group } from '../../../group/models/GroupModel';
import logger from '../../../../utils/logger';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Base URL for the REST API.
 *
 * TODO: read this from an environment variable or app config (e.g.
 *   import.meta.env.VITE_API_BASE_URL
 * so that dev / staging / production URLs can be set at build time).
 */
const API_BASE_URL = '/api'; // fallback; override via env var

// TODO: define an auth helper or interceptor.
// Options:
//   - Attach a Bearer token from a Pinia auth store: headers['Authorization'] = `Bearer ${token}`
//   - Use cookies / session (no extra header needed)
//   - API key header: headers['X-Api-Key'] = import.meta.env.VITE_API_KEY

// ---------------------------------------------------------------------------

export class RestApiBackend implements StorageBackend {
  readonly name = 'rest-api';

  private readonly baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * The REST backend is available when running in a browser context with
   * network access.  We can't truly know ahead of time, so we simply check
   * that we're in a browser.
   *
   * TODO: add a health-check ping on app init (e.g. GET /api/health) and
   *       cache the result so `isAvailable()` reflects actual reachability.
   */
  isAvailable(): boolean {
    return typeof window !== 'undefined' && typeof fetch !== 'undefined';
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * TODO: add auth headers here once authentication is implemented.
   * Example with JWT stored in a Pinia auth store:
   *
   *   import { useAuthStore } from 'src/stores/authStore';
   *   const token = useAuthStore().token;
   *   return token ? { 'Authorization': `Bearer ${token}` } : {};
   */
  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      // TODO: add auth header
    };
  }

  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  // ── Groups ─────────────────────────────────────────────────────────────────

  async loadAllGroups(): Promise<Group[]> {
    // TODO: implement
    //
    //   const res = await fetch(this.url('/groups'), { headers: this.getHeaders() });
    //   if (!res.ok) throw new Error(`loadAllGroups: HTTP ${res.status}`);
    //   return res.json() as Promise<Group[]>;
    //
    // Consider caching the result in a Pinia store so components don't block
    // on the network when rendering.
    logger.warn('[RestApiBackend] loadAllGroups not implemented');
    return [];
  }

  async saveGroups(groups: Group[]): Promise<void> {
    // TODO: implement
    //
    // Two strategies:
    //  A) Full replace — PUT /api/groups with the entire array (simple, matches
    //     the current file-per-group approach but less granular):
    //
    //       const res = await fetch(this.url('/groups'), {
    //         method: 'PUT',
    //         headers: this.getHeaders(),
    //         body: JSON.stringify(groups),
    //       });
    //       if (!res.ok) throw new Error(`saveGroups: HTTP ${res.status}`);
    //
    //  B) Delta sync — diff against cached state and send only changed/deleted
    //     groups (better for large datasets, requires diffing logic).
    logger.warn('[RestApiBackend] saveGroups not implemented');
  }

  async deleteGroup(groupId: string): Promise<void> {
    // TODO: implement
    //
    //   const res = await fetch(this.url(`/groups/${groupId}`), {
    //     method: 'DELETE',
    //     headers: this.getHeaders(),
    //   });
    //   if (!res.ok && res.status !== 404) throw new Error(`deleteGroup: HTTP ${res.status}`);
    logger.warn('[RestApiBackend] deleteGroup not implemented');
  }

  // ── Settings ───────────────────────────────────────────────────────────────

  async loadSettings(): Promise<Record<string, any>> {
    // TODO: implement
    //
    //   const res = await fetch(this.url('/settings'), { headers: this.getHeaders() });
    //   if (!res.ok) throw new Error(`loadSettings: HTTP ${res.status}`);
    //   return res.json();
    //
    // NOTE: decide whether settings are per-user (i.e. stored server-side with
    // the user account) or per-device (store in localStorage as fallback).
    logger.warn('[RestApiBackend] loadSettings not implemented');
    return {};
  }

  async saveSettings(settings: Record<string, any>): Promise<void> {
    // TODO: implement
    //
    //   const res = await fetch(this.url('/settings'), {
    //     method: 'PUT',
    //     headers: this.getHeaders(),
    //     body: JSON.stringify(settings),
    //   });
    //   if (!res.ok) throw new Error(`saveSettings: HTTP ${res.status}`);
    logger.warn('[RestApiBackend] saveSettings not implemented');
  }

  async getSetting(key: string, defaultValue: any = undefined): Promise<any> {
    // Naive implementation — loads full blob and picks one key.
    // TODO: if the API supports GET /settings/:key, use that instead to avoid
    //       fetching the entire settings object for a single value.
    try {
      const s = await this.loadSettings();
      return Object.prototype.hasOwnProperty.call(s, key) ? s[key] : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  async setSetting(key: string, value: any): Promise<void> {
    // Naive implementation — loads full blob, merges, saves.
    // TODO: if the API supports PATCH /settings, use that for a single-key update.
    try {
      const s = await this.loadSettings();
      s[key] = value;
      await this.saveSettings(s);
    } catch (e) {
      logger.error('[RestApiBackend] setSetting failed', e);
    }
  }

  // ── Import / Export ────────────────────────────────────────────────────────

  async importFromFile(file: File): Promise<OrganiserData> {
    // TODO: implement server-side import (useful for large files or server-side
    //       validation).
    //
    // Option A — upload to server for parsing:
    //   const body = new FormData();
    //   body.append('file', file);
    //   const res = await fetch(this.url('/import'), {
    //     method: 'POST',
    //     headers: { /* no Content-Type; FormData sets boundary */ },
    //     body,
    //   });
    //   if (!res.ok) throw new Error(`importFromFile: HTTP ${res.status}`);
    //   return res.json() as Promise<OrganiserData>;
    //
    // Option B — parse client-side (reuse ElectronBackend/CapacitorBackend logic)
    //   and then push the result to the server via saveGroups + saveSettings.
    //
    // Fallback to browser FileReader for now:
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
    // TODO: two options
    //
    // Option A — trigger a server-side export download:
    //   window.open(this.url('/export'), '_blank');
    //
    // Option B — build the JSON client-side and trigger a browser download
    //   (same technique as the web fallback in ElectronBackend):
    //
    //   const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    //   const url = URL.createObjectURL(blob);
    //   const a = document.createElement('a');
    //   a.href = url; a.download = 'backup.json'; a.click();
    //   URL.revokeObjectURL(url);
    logger.warn('[RestApiBackend] exportToFile not implemented', data);
  }

  // ── Diagnostics ────────────────────────────────────────────────────────────

  async getStoragePath(): Promise<string> {
    // Return the API base URL so the settings screen can show where data lives.
    return this.baseUrl;
  }
}

export const restApiStorage = new RestApiBackend();
