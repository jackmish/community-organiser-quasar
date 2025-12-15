import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

app.setName('Community Organiser');
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

  mainWindow = new BrowserWindow({
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
