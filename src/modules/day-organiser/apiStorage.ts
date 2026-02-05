import logger from 'src/utils/logger';
import { storage as backendStorage, loadSettings, saveSettings } from '../storage';

export function createStorageApi(store: any) {
  return {
    async loadData() {
      try {
        const data = await backendStorage.loadData();
        return data;
      } catch (err) {
        logger.error('apiStorage.loadData failed', err);
        throw err;
      }
    },

    async saveData(data: any) {
      try {
        await backendStorage.saveData(data);
      } catch (err) {
        logger.error('apiStorage.saveData failed', err);
        throw err;
      }
    },

    exportToFile(data: any) {
      try {
        if (typeof backendStorage.exportToFile === 'function') backendStorage.exportToFile(data);
      } catch (err) {
        logger.error('apiStorage.exportToFile failed', err);
        throw err;
      }
    },

    async importFromFile(file: File) {
      try {
        if (typeof backendStorage.importFromFile === 'function')
          return await backendStorage.importFromFile(file);
        throw new Error('importFromFile not implemented on backend');
      } catch (err) {
        logger.error('apiStorage.importFromFile failed', err);
        throw err;
      }
    },

    // expose settings helpers
    loadSettings,
    saveSettings,

    // convenience init hook: returns a thin surface bound to store
    initApp() {
      return {
        loadData: async () => {
          const data = await backendStorage.loadData();
          return data;
        },
        saveData: async (organiserData: any) => {
          await backendStorage.saveData(organiserData);
        },
      } as const;
    },
  };
}

export type ApiStorage = ReturnType<typeof createStorageApi>;
