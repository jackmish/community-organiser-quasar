/**
 * This file is used specifically for security reasons.
 * Here you can access Nodejs stuff and inject functionality into
 * the renderer thread (accessible there through the "window" object)
 *
 * WARNING!
 * If you import anything from node_modules, then make sure that the package is specified
 * in package.json > dependencies and NOT in devDependencies
 *
 * Example (injects window.myAPI.doAThing() into renderer thread):
 *
 *   import { contextBridge } from 'electron'
 *
 *   contextBridge.exposeInMainWorld('myAPI', {
 *     doAThing: () => {}
 *   })
 *
 * WARNING!
 * If accessing Node functionality (like fs) then in this file you MUST set the
 * following in your mainWindow's BrowserWindow constructor:
 *   mainWindow = new BrowserWindow({
 *     // ...
 *     webPreferences: {
 *       // ...
 *       sandbox: false // <-- to be able to import node modules in preload script
 *     }
 *   })
 */

/* eslint-disable @typescript-eslint/no-require-imports */

const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

// Debug: confirm preload script is loaded
console.log('Electron preload script loaded!');
window.testPreload = true;

contextBridge.exposeInMainWorld('electronAPI', {
  readDir: async (dirPath) => {
    return await fs.promises.readdir(dirPath);
  },
  // Simple test API
  isPreloadWorking: () => true,

  // Read JSON file
  readJsonFile: async (filePath) => {
    try {
      const data = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading file:', error);
      throw error;
    }
  },

  // Write JSON file
  writeJsonFile: async (filePath, data) => {
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  },
  ensureDir: async (dirPath) => {
    await fs.promises.mkdir(dirPath, { recursive: true });
    return true;
  },
  writeFile: async (filePath, data) => {
    await fs.promises.writeFile(filePath, data, 'utf8');
    return true;
  },

  // Delete a file
  deleteFile: async (filePath) => {
    try {
      await fs.promises.unlink(filePath);
      return true;
    } catch (err) {
      console.error('Error deleting file:', err);
      throw err;
    }
  },

  // Check if file exists
  fileExists: async (filePath) => {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  },

  // Get app data path
  getAppDataPath: () => ipcRenderer.invoke('get-app-data-path'),

  // Join paths
  joinPath: (...paths) => path.join(...paths),
});

// BLE bridge: IPC for main-process BLE adapter and Web Bluetooth helpers for renderer
let _webScan = null;
let _webScanHandler = null;

contextBridge.exposeInMainWorld('electronBLE', {
  // Main-process IPC wrappers (if native adapter present)
  startScan: () => ipcRenderer.invoke('ble:start-scan'),
  stopScan: () => ipcRenderer.invoke('ble:stop-scan'),
  connect: (id) => ipcRenderer.invoke('ble:connect', id),
  disconnect: (id) => ipcRenderer.invoke('ble:disconnect', id),

  // Web Bluetooth availability
  webBluetoothAvailable: () => typeof navigator !== 'undefined' && !!navigator.bluetooth,

  // Request a device via the browser prompt filtered by service UUID (returns minimal info)
  requestDevice: async (serviceUuid) => {
    if (
      !(
        typeof navigator !== 'undefined' &&
        navigator.bluetooth &&
        navigator.bluetooth.requestDevice
      )
    )
      return null;
    try {
      const options = serviceUuid
        ? { filters: [{ services: [serviceUuid] }], optionalServices: [serviceUuid] }
        : { acceptAllDevices: true };
      const device = await navigator.bluetooth.requestDevice(options);
      return {
        id: device.id,
        name: device.name || null,
        uuids: device.uuids || [],
      };
    } catch (err) {
      console.warn('requestDevice failed', err);
      return null;
    }
  },

  // Start a low-level LE advertisement scan. Discovered devices are emitted as window events 'web-ble-device'
  startScanWeb: async (serviceUuid) => {
    if (
      !(
        typeof navigator !== 'undefined' &&
        navigator.bluetooth &&
        navigator.bluetooth.requestLEScan
      )
    )
      return false;
    try {
      const options = serviceUuid
        ? { filters: [{ services: [serviceUuid] }], keepRepeatedDevices: true }
        : { acceptAllAdvertisements: true, keepRepeatedDevices: true };

      // remove any existing scan
      if (_webScan && typeof _webScan.stop === 'function') {
        try {
          _webScan.stop();
        } catch (e) {
          console.warn('stop existing webScan failed', e);
        }
        _webScan = null;
      }

      _webScan = await navigator.bluetooth.requestLEScan(options);

      _webScanHandler = (event) => {
        const device = {
          id:
            event.device && event.device.id
              ? event.device.id
              : `${event.device && event.device.name ? event.device.name : 'unknown'}:${event.rssi || 0}`,
          name: (event.device && event.device.name) || null,
          rssi: event.rssi || null,
          serviceUuids: event.uuids || [],
          manufacturerData: (() => {
            try {
              const obj = {};
              for (const [key, value] of event.manufacturerData.entries()) {
                // value is a DataView/ArrayBufferView - convert to hex string
                const buf = new Uint8Array(value.buffer || value);
                obj[key] = Array.from(buf)
                  .map((b) => b.toString(16).padStart(2, '0'))
                  .join('');
              }
              return obj;
            } catch (e) {
              return {};
            }
          })(),
        };
        window.dispatchEvent(new CustomEvent('web-ble-device', { detail: device }));
      };

      navigator.bluetooth.addEventListener('advertisementreceived', _webScanHandler);
      return true;
    } catch (err) {
      console.warn('startScanWeb failed', err);
      return false;
    }
  },

  stopScanWeb: () => {
    try {
      if (_webScan && typeof _webScan.stop === 'function') {
        try {
          _webScan.stop();
        } catch (e) {
          console.warn('stop webScan failed', e);
        }
        _webScan = null;
      }
      if (_webScanHandler && navigator && navigator.bluetooth) {
        try {
          navigator.bluetooth.removeEventListener('advertisementreceived', _webScanHandler);
        } catch (e) {
          console.warn('removeEventListener failed', e);
        }
        _webScanHandler = null;
      }
      return true;
    } catch (err) {
      return false;
    }
  },
});
