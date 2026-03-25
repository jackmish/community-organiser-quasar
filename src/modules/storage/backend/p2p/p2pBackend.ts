/**
 * P2PBackend — persistence layer using peer-to-peer networking (WebRTC DataChannel).
 *
 * Status: STUB — all methods are outlined with TODOs.
 *         Implement when P2P sync between devices is required.
 *
 * Concept:
 *  Two or more instances of the app connect directly (no central server) and
 *  keep their data in sync.  Each peer still uses a local backend
 *  (ElectronBackend / CapacitorBackend) as its primary store; this backend
 *  overlays a sync layer on top:
 *
 *    Local store  ←→  P2PBackend  ←→  DataChannel  ←→  Remote peer
 *
 * Recommended transport: WebRTC DataChannel (browser-native, works in Electron
 * and Capacitor WebViews).  Signalling (exchanging SDP offers/answers and ICE
 * candidates) still needs a lightweight rendezvous server or a shared
 * copy-paste mechanism (QR code, manual paste).
 *
 * Suggested libraries:
 *  - PeerJS     (https://peerjs.com)  — wraps WebRTC with a simple API and
 *                provides a free hosted signalling server for development.
 *  - simple-peer (npm: simple-peer)   — thin WebRTC wrapper, no built-in
 *                signalling; you bring your own.
 *  - Trystero   (npm: trystero)       — zero-server P2P using public IPFS /
 *                Nostr / Supabase / Firebase as the signalling bus.
 *
 * Installation example (PeerJS):
 *   npm install peerjs
 *
 * ─── Data model for sync ─────────────────────────────────────────────────────
 *
 *  Each mutation (save group, delete group, save settings) is wrapped in a
 *  timestamped "change envelope" broadcast to all connected peers.  On receive,
 *  a peer applies the change to its local store if the remote timestamp is newer.
 *  This is a last-write-wins (LWW) CRDT strategy — simple enough to start with.
 *
 *  For conflict resolution beyond LWW, consider:
 *  - Automerge  (npm: automerge)  — CRDT library for JSON documents
 *  - Yjs        (npm: yjs)        — CRDT + awareness protocol, good for
 *                                   collaborative editing
 *
 * ─── Pinia integration ────────────────────────────────────────────────────────
 *
 *  P2P is where Pinia really shines:
 *  - The Pinia store acts as the local truth; incoming peer changes mutate it
 *    directly so all Vue components react in real time.
 *  - A `peers` ref in the store tracks connected peer IDs and their status,
 *    which the UI can display (e.g. "3 devices connected").
 *  - Actions that save data can broadcast the diff to peers after persisting
 *    locally, keeping the pattern:  UI → action → local backend + broadcast.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { StorageBackend, OrganiserData } from '../StorageBackend';
import type { Group } from '../../../group/models/GroupModel';
import logger from '../../../../utils/logger';

// TODO: uncomment when a WebRTC / P2P library is chosen and installed.
// import Peer, { type DataConnection } from 'peerjs';
// — or —
// import * as Trystero from 'trystero';

// ---------------------------------------------------------------------------
// Change envelope — the unit of data exchanged between peers
// ---------------------------------------------------------------------------

/**
 * TODO: define the full message schema once the sync strategy is decided.
 *
 * Minimal sketch:
 *
 *   type SyncMessage =
 *     | { type: 'saveGroup';   group: Group;   ts: number }
 *     | { type: 'deleteGroup'; groupId: string; ts: number }
 *     | { type: 'saveSettings'; settings: Record<string, any>; ts: number }
 *     | { type: 'requestSync' }   // ask a peer to send its full state
 *     | { type: 'fullSync'; data: OrganiserData };
 */

// ---------------------------------------------------------------------------
// P2PBackend
// ---------------------------------------------------------------------------

export class P2PBackend implements StorageBackend {
  readonly name = 'p2p-webrtc';

  /**
   * P2P backend is available in any environment that supports WebRTC.
   * WebRTC DataChannel is available in modern Chromium, Firefox, Safari,
   * Electron (Chromium), and Capacitor WebViews.
   */
  isAvailable(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.RTCPeerConnection !== 'undefined'
    );
  }

  // ── Connection lifecycle ───────────────────────────────────────────────────

  /**
   * TODO: initialise the P2P connection layer.
   *
   * Steps (PeerJS example):
   *   const peer = new Peer(localPeerId, { host: 'signalling-server.example', port: 443 });
   *   peer.on('open', (id) => logger.info('[P2PBackend] connected as', id));
   *   peer.on('connection', (conn) => this.handleIncomingConnection(conn));
   *
   * Call this from the app boot sequence (e.g. apiRoot.ts or a boot/ file)
   * AFTER the local backend has loaded its data, so we can serve a fullSync on request.
   */
  async connect(_localPeerId?: string): Promise<void> {
    // TODO: implement
    logger.warn('[P2PBackend] connect not implemented');
  }

  /**
   * TODO: connect to a specific remote peer by ID.
   * const conn = peer.connect(remotePeerId);
   * conn.on('open', () => this.sendMessage(conn, { type: 'requestSync' }));
   */
  async connectToPeer(_remotePeerId: string): Promise<void> {
    // TODO: implement
    logger.warn('[P2PBackend] connectToPeer not implemented');
  }

  /**
   * TODO: handle an incoming DataConnection.
   * Register `data` listener, reply to `requestSync` with a fullSync message.
   */
  private handleIncomingConnection(_conn: any): void {
    // TODO: implement
    //   conn.on('data', (msg) => this.handleMessage(conn, msg));
  }

  /**
   * TODO: route incoming sync messages (saveGroup / deleteGroup / fullSync …)
   * and apply them to the local backend + Pinia store.
   */
  private handleMessage(_conn: any, _msg: unknown): void {
    // TODO: implement
    //   switch (msg.type) {
    //     case 'saveGroup':   localBackend.saveGroups([msg.group]); break;
    //     case 'deleteGroup': localBackend.deleteGroup(msg.groupId); break;
    //     case 'fullSync':    applyFullSync(msg.data); break;
    //     case 'requestSync': this.sendMessage(conn, { type: 'fullSync', data: ... }); break;
    //   }
  }

  /**
   * TODO: broadcast a message to all connected peers.
   */
  private broadcast(_msg: unknown): void {
    // TODO: iterate this.connections and call conn.send(msg) on each.
  }

  // ── Groups ─────────────────────────────────────────────────────────────────

  async loadAllGroups(): Promise<Group[]> {
    // P2P is a sync overlay, not a primary store.
    // Delegate to the active local backend (ElectronBackend / CapacitorBackend).
    //
    // TODO: after loading from local, optionally request a fullSync from the
    // most recently seen peer to pull in remote changes made while offline.
    logger.warn('[P2PBackend] loadAllGroups: no local backend wired up yet');
    return [];
  }

  async saveGroups(groups: Group[]): Promise<void> {
    // TODO:
    //   1. Persist locally via the wired local backend.
    //   2. Broadcast { type: 'saveGroups', groups, ts: Date.now() } to peers.
    logger.warn('[P2PBackend] saveGroups not implemented');
  }

  async deleteGroup(groupId: string): Promise<void> {
    // TODO:
    //   1. Delete locally via local backend.
    //   2. Broadcast { type: 'deleteGroup', groupId, ts: Date.now() } to peers.
    logger.warn('[P2PBackend] deleteGroup not implemented');
  }

  // ── Settings ───────────────────────────────────────────────────────────────

  async loadSettings(): Promise<Record<string, any>> {
    // TODO: delegate to local backend.
    // Settings are typically device-local (theme, active group …) so syncing
    // them across peers may not be desirable — decide per-key.
    logger.warn('[P2PBackend] loadSettings not implemented');
    return {};
  }

  async saveSettings(settings: Record<string, any>): Promise<void> {
    // TODO: delegate to local backend.
    // Only broadcast settings that should be shared (e.g. shared task lists).
    logger.warn('[P2PBackend] saveSettings not implemented');
  }

  async getSetting(key: string, defaultValue: any = undefined): Promise<any> {
    try {
      const s = await this.loadSettings();
      return Object.prototype.hasOwnProperty.call(s, key) ? s[key] : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  async setSetting(key: string, value: any): Promise<void> {
    try {
      const s = await this.loadSettings();
      s[key] = value;
      await this.saveSettings(s);
    } catch (e) {
      logger.error('[P2PBackend] setSetting failed', e);
    }
  }

  // ── Import / Export ────────────────────────────────────────────────────────

  async importFromFile(file: File): Promise<OrganiserData> {
    // Reuse browser FileReader — same as other backends.
    // After importing, consider broadcasting a fullSync to connected peers so
    // they receive the imported data immediately.
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
    // TODO: trigger browser download (same pattern as RestApiBackend option B):
    //
    //   const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    //   const url = URL.createObjectURL(blob);
    //   const a = document.createElement('a'); a.href = url; a.download = 'backup.json';
    //   a.click(); URL.revokeObjectURL(url);
    logger.warn('[P2PBackend] exportToFile not implemented', data);
  }

  // ── Diagnostics ────────────────────────────────────────────────────────────

  async getStoragePath(): Promise<string> {
    // TODO: return a string describing the active peer ID and number of
    // connected peers, e.g. "p2p://peer-abc123 (2 peers connected)".
    return 'p2p://not-connected';
  }
}

export const p2pStorage = new P2PBackend();
