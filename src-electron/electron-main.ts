import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import { fileURLToPath } from 'url';

app.setName('CO21 - Community Organiser');
console.log('App data path:', app.getPath('userData'));
// Fix for ES modules - __dirname is not defined
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// needed in case process is undefined under Linux
const platform = process.platform || os.platform();

let mainWindow: BrowserWindow | undefined;

console.log('Electron app name:', app.getName());

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
}

// Handle IPC requests
ipcMain.handle('get-app-data-path', () => {
  return app.getPath('userData');
});

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

      // Add JSON content as connections.json
      zipfile.addBuffer(Buffer.from(jsonString, 'utf8'), 'connections.json');
      zipfile.end();

      await new Promise<void>((resolve, reject) => {
        outStream.on('close', () => resolve());
        outStream.on('error', (err) => reject(err));
      });

      return zipPath;
    } catch (err) {
      console.error('export:zip failed', err);
      throw err;
    }
  },
);

app.whenReady().then(createWindow);

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
