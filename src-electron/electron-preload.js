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
