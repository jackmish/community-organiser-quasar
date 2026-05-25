import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { loadDotEnv } from './loadDotEnv';
loadDotEnv();
import {
  startLanPairingServer,
  setLanTrustedContractDeviceIds,
  setLanTrustedContractPeers,
  type LanTrustedContractPeer,
  stopLanPairingServer,
  resolveLanPairing,
  setLanPairingMainWindowProvider,
  isLanPairingListening,
  getLanIPv4Addresses,
  type LanIdentityPublic,
} from './lanPairingServer';
import { CO21_LAN_PAIRING_PORT } from 'src/modules/lan/lanPairingConstants';
import { browseCo21Organisers, destroyBonjour } from './lanMdns';
import { startGoogleAuthFlow, refreshAccessToken } from './googleAuth';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import { fileURLToPath } from 'url';
import logger from 'src/utils/logger';
// Fix for ES modules - __dirname is not defined; derive from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.setName('CO21 - Community Organiser');
// Read package.json version (best-effort). Keep this simple and cast where needed.
let packageAppVersion: string | undefined;
try {
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkgRaw = fs.readFileSync(pkgPath, 'utf8');
    const pkgJson = JSON.parse(pkgRaw);
    if (pkgJson && pkgJson.version) {
      packageAppVersion = String(pkgJson.version);
      try {
        // set app version for consistency (cast to any to avoid typing issues)
        if ((app as any).setVersion) {
          try {
            (app as any).setVersion(String(pkgJson.version));
          } catch (e) {
            logger.error('setVersion invocation failed', e);
          }
        }
      } catch (e) {
        logger.error('Setting app version failed', e);
      }
    }
  }
} catch (e) {
  logger.error('Failed to read package.json for app version', e);
}

// needed in case process is undefined under Linux
const platform = process.platform || os.platform();

let mainWindow: BrowserWindow | undefined;

function createWindow() {
  /**
   * Initial window options
   */

  const currentDir = fileURLToPath(new URL('.', import.meta.url));

  // Choose appropriate icon for platform (use .ico on Windows)
  const iconPath = path.resolve(
    __dirname,
    process.platform === 'win32'
      ? '../public/icons/co21-logo.ico'
      : '../public/icons/co21-logo.png',
  );

  mainWindow = new BrowserWindow({
    icon: iconPath,
    // ...
    webPreferences: {
      // HERE IS THE MAGIC:
      // icon: path.resolve(__dirname, 'icons/icon.png'), // tray icon
      // width: 1000,
      // height: 600,
      // useContentSize: true,
      preload: process.env.QUASAR_ELECTRON_PRELOAD_FOLDER
        ? path.resolve(
            currentDir,
            path.join(
              process.env.QUASAR_ELECTRON_PRELOAD_FOLDER,
              'electron-preload' + process.env.QUASAR_ELECTRON_PRELOAD_EXTENSION,
            ),
          )
        : path.resolve(currentDir, '../src-electron/electron-preload.js'),
      sandbox: false,
    },
  });

  // Maximize window on Windows
  if (process.platform === 'win32') {
    mainWindow.maximize();
  }

  // mainWindow = new BrowserWindow({
  //     webPreferences: {
  //     // HERE IS THE MAGIC:
  //     preload: path.resolve(
  //       currentDir,
  //       path.join(process.env.QUASAR_ELECTRON_PRELOAD_FOLDER, 'electron-preload' + process.env.QUASAR_ELECTRON_PRELOAD_EXTENSION)
  //     )
  //   },
  //   icon: path.resolve(__dirname, 'icons/icon.png'), // tray icon
  //   width: 1000,
  //   height: 600,
  //   useContentSize: true,
  // });

  mainWindow.loadURL(process.env.APP_URL || '');

  // Inject app version and name into renderer global scope after page load
  // Inject app version/name into renderer after page load so UI can read it synchronously.
  mainWindow.webContents.on('did-finish-load', () => {
    try {
      const ver = JSON.stringify(packageAppVersion || app.getVersion());
      const name = JSON.stringify(app.getName());
      mainWindow?.webContents.executeJavaScript(
        `window.APP_VERSION = ${ver}; window.APP_NAME = ${name};`,
      );
    } catch (e) {
      logger.error('Failed to inject APP_VERSION/APP_NAME into renderer', e);
    }
  });

  if (process.env.DEBUGGING) {
    // if on DEV or Production with debug enabled
    mainWindow.webContents.openDevTools();
  } else {
    // we're on production; no access to devtools pls
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow?.webContents.closeDevTools();
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = undefined;
  });

  setLanPairingMainWindowProvider(() => mainWindow);
}

// Handle IPC requests
ipcMain.handle('get-app-data-path', () => {
  return app.getPath('userData');
});

/** Windows COMPUTERNAME / hostname — often matches the router device list. */
ipcMain.handle('system:host-device-label', () => {
  const candidates: string[] = [];
  if (process.platform === 'win32') {
    const pc = process.env.COMPUTERNAME;
    if (pc) candidates.push(pc);
  }
  try {
    candidates.push(os.hostname());
  } catch {
    void 0;
  }
  const hostEnv = process.env.HOSTNAME;
  if (hostEnv) candidates.push(hostEnv);

  for (const raw of candidates) {
    const label = sanitizeHostDeviceLabelForMain(raw);
    if (label) return label;
  }
  return '';
});

function sanitizeHostDeviceLabelForMain(raw: string | undefined): string {
  if (!raw) return '';
  let s = String(raw).trim();
  if (!s) return '';
  const dot = s.indexOf('.');
  if (dot > 0) s = s.slice(0, dot);
  s = s.replace(/[^\w\s._-]+/g, '').trim();
  if (!s || s.length < 2) return '';
  const lower = s.toLowerCase();
  if (
    lower === 'localhost' ||
    lower === 'localdomain' ||
    lower === 'workgroup' ||
    lower === 'unknown'
  ) {
    return '';
  }
  return s.length > 64 ? s.slice(0, 64) : s;
}

ipcMain.handle('lan:start-server', async (_evt, identity: LanIdentityPublic) => {
  try {
    const r = await startLanPairingServer(identity);
    return { ok: true as const, port: r.port, addresses: r.addresses };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false as const, error: msg };
  }
});

ipcMain.handle('lan:stop-server', () => {
  stopLanPairingServer();
  return { ok: true as const };
});

ipcMain.handle('lan:resolve-pair', (_evt, payload: { token: string; accept: boolean }) => {
  const ok = resolveLanPairing(payload.token, payload.accept);
  return { ok };
});

ipcMain.handle('lan:status', () => ({
  listening: isLanPairingListening(),
  port: CO21_LAN_PAIRING_PORT,
  addresses: getLanIPv4Addresses(),
}));

ipcMain.handle(
  'lan:set-trusted-contract-devices',
  (_evt, payload: string[] | LanTrustedContractPeer[]) => {
    if (!Array.isArray(payload)) {
      setLanTrustedContractDeviceIds([]);
      return { ok: true as const, count: 0 };
    }
    if (payload.length > 0 && typeof payload[0] === 'object' && payload[0] !== null) {
      const peers = payload as LanTrustedContractPeer[];
      setLanTrustedContractPeers(peers);
      return { ok: true as const, count: peers.length };
    }
    const list = payload.filter((id): id is string => typeof id === 'string');
    setLanTrustedContractDeviceIds(list);
    return { ok: true as const, count: list.length };
  },
);

ipcMain.handle(
  'lan:browse-co21',
  async (_evt, opts?: { timeoutMs?: number; excludeDeviceId?: string }) => {
    try {
      const q: { timeoutMs: number; excludeDeviceId?: string } = {
        timeoutMs: typeof opts?.timeoutMs === 'number' ? opts.timeoutMs : 4000,
      };
      if (typeof opts?.excludeDeviceId === 'string') {
        q.excludeDeviceId = opts.excludeDeviceId;
      }
      const devices = await browseCo21Organisers(q);
      return { ok: true as const, devices };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false as const, error: msg, devices: [] };
    }
  },
);

// Synchronous handler so preload can obtain the package version before renderer starts
// (removed) synchronous IPC handler — preload should not need to synchronously query main

// Show native folder chooser and return selected path or null
ipcMain.handle('dialog:select-folder', async (event) => {
  const res = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
  });
  if (res.canceled || !res.filePaths || res.filePaths.length === 0) return null;
  return res.filePaths[0];
});

// Create a .zip archive containing a single JSON file named 'connections.json'
ipcMain.handle(
  'export:zip',
  async (event, folder: string, filename: string, jsonString: string) => {
    try {
      if (!folder) throw new Error('No folder provided');
      await fsPromises.mkdir(folder, { recursive: true });
      const zipPath = path.join(folder, filename);
      const yazlMod: any = await import('yazl');
      const ZipFile = yazlMod.ZipFile || (yazlMod && yazlMod.default && yazlMod.default.ZipFile);
      const zipfile = new ZipFile();

      // Pipe output stream to file
      const outStream = fs.createWriteStream(zipPath);
      zipfile.outputStream.pipe(outStream);

      // Use a JSON filename derived from the zip filename (replace .zip with .json)
      const internalName = String(filename).replace(/\.zip$/i, '.json');
      const entryName = internalName || 'backup.json';

      // Try to generate a cleaned (pretty) JSON and add it under the canonical
      // internal filename. If compression fails, fall back to the original JSON.
      try {
        const parsed = JSON.parse(jsonString);

        const compressHistory = (obj: any): any => {
          if (!obj || typeof obj !== 'object') return obj;
          if (Array.isArray(obj)) return obj.map(compressHistory);
          // Traverse groups/tasks/history pattern defensively
          for (const k of Object.keys(obj)) {
            const v = obj[k];
            if (k === 'history' && Array.isArray(v)) {
              obj[k] = v.map((entry: any) => {
                if (!entry || typeof entry !== 'object') return entry;
                ['old', 'new'].forEach((field) => {
                  const val = entry[field];
                  if (Array.isArray(val) && val.length > 5) {
                    const allPlaceholders = val.every(
                      (it: any) => typeof it === 'string' && it.startsWith('[Object]'),
                    );
                    if (allPlaceholders) {
                      // remove useless placeholder data entirely
                      delete entry[field];
                    }
                  }
                });
                return entry;
              });
            } else if (typeof v === 'object' && v !== null) {
              compressHistory(v);
            }
          }
          return obj;
        };

        const pretty = compressHistory(parsed);
        const prettyStr = JSON.stringify(pretty, null, 2);
        zipfile.addBuffer(Buffer.from(prettyStr, 'utf8'), entryName);
      } catch (e) {
        logger.error('Pretty JSON generation failed for export; falling back to original', e);
        // If pretty generation fails, add original JSON so export still works.
        zipfile.addBuffer(Buffer.from(jsonString, 'utf8'), entryName);
      }
      zipfile.end();

      await new Promise<void>((resolve, reject) => {
        outStream.on('close', () => resolve());
        outStream.on('error', (err) => reject(err));
      });

      return zipPath;
    } catch (err) {
      logger.error('export:zip failed', err);
      throw err;
    }
  },
);

// ── Google OAuth IPC ──────────────────────────────────────────────────────
ipcMain.handle('google:auth-start', async () => {
  try {
    const result = await startGoogleAuthFlow();
    return { ok: true as const, ...result };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false as const, error: msg };
  }
});

ipcMain.handle('google:auth-refresh', async (_evt, refreshToken: string) => {
  try {
    const tokens = await refreshAccessToken(refreshToken);
    return { ok: true as const, tokens };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false as const, error: msg };
  }
});

app.whenReady().then(createWindow);

app.on('before-quit', () => {
  stopLanPairingServer();
  destroyBonjour();
});

app.on('window-all-closed', () => {
  if (platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === undefined) {
    createWindow();
  }
});
