/**
 * BluetoothBackend — persistence / sync layer using the Web Bluetooth API
 * (or a Capacitor Bluetooth plugin for native mobile).
 *
 * Status: STUB — all methods are outlined with TODOs.
 *
 * Use-cases:
 *  - Offline device-to-device sync without Wi-Fi or a server (e.g. two phones
 *    in a lesson exchanging a shared task list).
 *  - Range-limited sharing: only devices physically nearby can sync, which is
 *    intentional in some community-organiser scenarios.
 *
 * Transport options (pick one per target platform):
 * ┌──────────────────────────┬──────────────────────────────────────────────┐
 * │ Platform                 │ Recommended approach                         │
 * ├──────────────────────────┼──────────────────────────────────────────────┤
 * │ Browser / Electron       │ Web Bluetooth API (navigator.bluetooth)      │
 * │                          │ — Chrome 56+, Edge 79+.  Firefox: behind flag│
 * │                          │ — Works in Electron renderer process         │
 * ├──────────────────────────┼──────────────────────────────────────────────┤
 * │ Capacitor (iOS / Android)│ @capacitor-community/bluetooth-le            │
 * │                          │   npm install @capacitor-community/bluetooth-le│
 * │                          │   npx cap sync                               │
 * └──────────────────────────┴──────────────────────────────────────────────┘
 *
 * BLE (Bluetooth Low Energy) model:
 *  - One device acts as a GATT **server** (peripheral) and advertises a custom
 *    service UUID.
 *  - The other acts as a GATT **client** (central) and connects, reads, writes
 *    characteristics.
 *  - Data size per characteristic write is limited (~512 bytes in BLE 4.x,
 *    ~244 bytes in practice) so large payloads must be chunked.
 *
 * Suggested custom GATT profile for this app:
 *   Service UUID:            'co21-organiser-0000-0000-000000000001'
 *   Characteristic — DATA:   'co21-organiser-0000-0000-000000000002'
 *     Properties: read | write | notify
 *     Semantics:  chunked JSON (groups + settings as OrganiserData)
 *   Characteristic — CTRL:   'co21-organiser-0000-0000-000000000003'
 *     Properties: write
 *     Semantics:  control commands (requestSync, ack, reset)
 *
 * ─── Chunking strategy ───────────────────────────────────────────────────────
 *
 *  Since BLE MTU is small, implement a simple chunked transfer:
 *    sender:   split JSON string into N x 200-byte chunks
 *              write chunk[0] = header: { total: N, id: transferId }
 *              write chunk[1..N] = { seq, transferId, data: base64 }
 *    receiver: reassemble, parse, apply
 *
 *  npm package `bluetooth-terminal` provides a ready-made chunked serial
 *  abstraction over BLE if you don't want to implement this manually.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { StorageBackend, OrganiserData } from '../StorageBackend';
import type { Group } from '../../../group/models/GroupModel';
import logger from '../../../../utils/logger';

// TODO: uncomment the appropriate import once installed.
// Browser / Electron:
//   (Web Bluetooth is a browser-native API — no npm install needed,
//    but TypeScript types can be added:  npm install --save-dev @types/web-bluetooth)
//
// Capacitor:
//   import { BleClient } from '@capacitor-community/bluetooth-le';

// ---------------------------------------------------------------------------
// GATT profile constants — align these with the companion device
// ---------------------------------------------------------------------------

const SERVICE_UUID = 'co21-organiser-0000-0000-000000000001'; // TODO: replace with real UUID
const CHARACTERISTIC_DATA = 'co21-organiser-0000-0000-000000000002';
const CHARACTERISTIC_CTRL = 'co21-organiser-0000-0000-000000000003';

const CHUNK_SIZE = 200; // bytes — stay under BLE MTU minus overhead

// ---------------------------------------------------------------------------
// BluetoothBackend
// ---------------------------------------------------------------------------

export class BluetoothBackend implements StorageBackend {
  readonly name = 'bluetooth-le';

  /**
   * Web Bluetooth is available only in secure contexts (HTTPS or localhost)
   * and in supported browsers (Chrome, Edge, Electron).
   * On Capacitor, check for the BleClient plugin instead.
   */
  isAvailable(): boolean {
    // Web Bluetooth path
    if (typeof navigator !== 'undefined' && 'bluetooth' in navigator) return true;
    // TODO: Capacitor path — check if BleClient.initialize() is callable:
    //   try { return typeof BleClient !== 'undefined'; } catch { return false; }
    return false;
  }

  // ── Connection lifecycle ───────────────────────────────────────────────────

  /**
   * TODO: scan for and connect to a nearby co21 device.
   *
   * Web Bluetooth (browser / Electron):
   *   const device = await navigator.bluetooth.requestDevice({
   *     filters: [{ services: [SERVICE_UUID] }],
   *   });
   *   const server = await device.gatt!.connect();
   *   const service = await server.getPrimaryService(SERVICE_UUID);
   *   this.dataChar = await service.getCharacteristic(CHARACTERISTIC_DATA);
   *   this.ctrlChar = await service.getCharacteristic(CHARACTERISTIC_CTRL);
   *   await this.dataChar.startNotifications();
   *   this.dataChar.addEventListener('characteristicvaluechanged', (e) => this.onChunk(e));
   *
   * Capacitor:
   *   await BleClient.initialize();
   *   await BleClient.requestDevice({ services: [SERVICE_UUID] })
   *     .then(device => BleClient.connect(device.deviceId, ...));
   */
  async connect(): Promise<void> {
    // TODO: implement
    logger.warn('[BluetoothBackend] connect not implemented');
  }

  /**
   * TODO: disconnect from the current GATT server and clean up listeners.
   *   device.gatt?.disconnect();
   */
  async disconnect(): Promise<void> {
    // TODO: implement
    logger.warn('[BluetoothBackend] disconnect not implemented');
  }

  // ── Chunked transfer helpers ───────────────────────────────────────────────

  /**
   * TODO: split a JSON string into CHUNK_SIZE-byte pieces and write them
   * sequentially to the DATA characteristic.
   *
   *   const buf = new TextEncoder().encode(json);
   *   for (let i = 0; i < buf.length; i += CHUNK_SIZE) {
   *     const chunk = buf.slice(i, i + CHUNK_SIZE);
   *     await this.dataChar.writeValueWithResponse(chunk);
   *   }
   *   // Signal end-of-transfer via CTRL characteristic
   *   await this.ctrlChar.writeValueWithResponse(new TextEncoder().encode('END'));
   */
  private async sendChunked(_json: string): Promise<void> {
    // TODO: implement
    logger.warn('[BluetoothBackend] sendChunked not implemented');
    void CHUNK_SIZE; // suppress "unused" lint warning until implemented
  }

  /**
   * TODO: accumulate incoming BLE notification chunks and reassemble the
   * JSON string when the END signal is received.
   *
   *   private buffer = '';
   *   private onChunk(event: Event) {
   *     const value = (event.target as BluetoothRemoteGATTCharacteristic).value!;
   *     const text = new TextDecoder().decode(value);
   *     if (text === 'END') { this.applyReceived(this.buffer); this.buffer = ''; }
   *     else this.buffer += text;
   *   }
   */

  // ── Groups ─────────────────────────────────────────────────────────────────

  async loadAllGroups(): Promise<Group[]> {
    // BLE backend is primarily a sync/transfer mechanism, not a primary store.
    // Typical flow:
    //   1. Connect to remote device.
    //   2. Write a CTRL command requesting a fullSync.
    //   3. Receive chunked OrganiserData via DATA notifications.
    //   4. Return the groups from the received data.
    //
    // TODO: implement the request-response flow described above.
    logger.warn('[BluetoothBackend] loadAllGroups not implemented');
    return [];
  }

  async saveGroups(groups: Group[]): Promise<void> {
    // TODO:
    //   1. Serialise groups to JSON (use safe replacer to strip circular refs).
    //   2. Call this.sendChunked(json) to push to the connected remote device.
    logger.warn('[BluetoothBackend] saveGroups not implemented');
  }

  async deleteGroup(groupId: string): Promise<void> {
    // TODO: send a small control message:
    //   await this.ctrlChar.writeValueWithResponse(
    //     new TextEncoder().encode(JSON.stringify({ cmd: 'deleteGroup', groupId }))
    //   );
    logger.warn('[BluetoothBackend] deleteGroup not implemented');
  }

  // ── Settings ───────────────────────────────────────────────────────────────

  async loadSettings(): Promise<Record<string, any>> {
    // TODO: request settings blob from remote device via BLE read or
    // a dedicated settings characteristic.
    // Device-local settings (theme, display prefs) should stay local and not
    // be transferred over BLE.
    logger.warn('[BluetoothBackend] loadSettings not implemented');
    return {};
  }

  async saveSettings(settings: Record<string, any>): Promise<void> {
    // TODO: only sync settings that are explicitly marked as "shared".
    logger.warn('[BluetoothBackend] saveSettings not implemented');
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
      logger.error('[BluetoothBackend] setSetting failed', e);
    }
  }

  // ── Import / Export ────────────────────────────────────────────────────────

  async importFromFile(file: File): Promise<OrganiserData> {
    // BLE devices exchange data over the air, but we still support file-based
    // import as a fallback (e.g. loading a backup before broadcasting it).
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
    // TODO: trigger a browser download of the serialised data:
    //
    //   const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    //   const url = URL.createObjectURL(blob);
    //   const a = document.createElement('a'); a.href = url; a.download = 'backup.json';
    //   a.click(); URL.revokeObjectURL(url);
    logger.warn('[BluetoothBackend] exportToFile not implemented', data);
  }

  // ── Diagnostics ────────────────────────────────────────────────────────────

  async getStoragePath(): Promise<string> {
    // TODO: return the BLE device name / address of the connected remote device.
    // e.g. 'bluetooth://CO21-Device (AA:BB:CC:DD:EE:FF)'
    return 'bluetooth://not-connected';
  }
}

// Re-export UUIDs so companion advertising code can import them from one place.
export { SERVICE_UUID, CHARACTERISTIC_DATA, CHARACTERISTIC_CTRL };

export const bluetoothStorage = new BluetoothBackend();
