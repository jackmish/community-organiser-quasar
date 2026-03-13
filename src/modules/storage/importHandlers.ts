import type { Ref } from 'vue';

export interface StorageApi {
  importFromFile: (file: File) => Promise<any>;
  saveData: (data: any) => Promise<void>;
  loadData: () => Promise<void>;
}

export interface QuasarLike {
  loading?: { show: (opts?: any) => void; hide: () => void };
  notify?: (opts: any) => void;
}

/**
 * Creates a self-contained import handler.
 * Extracted from DayOrganiserPage so it can be tested without mounting the page.
 */
export function createImportHandler(args: {
  storage: StorageApi;
  quasar: QuasarLike;
  reloadKey: Ref<number>;
  showFirstRunDialog: Ref<boolean>;
}) {
  const { storage, quasar, reloadKey, showFirstRunDialog } = args;

  const safeShow = () => {
    try {
      quasar.loading?.show({ message: 'Importing data...' });
    } catch (e) {
      void e;
    }
  };

  const safeHide = () => {
    try {
      quasar.loading?.hide();
    } catch (e) {
      void e;
    }
  };

  const safeNotify = (opts: any) => {
    try {
      if (quasar.notify) return quasar.notify(opts);
    } catch (e) {
      void e;
    }
    try {
      if (opts?.message) alert(opts.message);
    } catch (e) {
      void e;
    }
  };

  async function handleImportFile(file: File) {
    try {
      safeShow();
      const data = await storage.importFromFile(file);
      if (data) {
        await storage.saveData(data);
        await storage.loadData();
      }
      safeHide();
      showFirstRunDialog.value = false;
      reloadKey.value += 1;
      safeNotify({ type: 'positive', message: 'Import successful' });
    } catch (err) {
      safeHide();
      console.error('Import failed', err);
      safeNotify({
        type: 'negative',
        message: 'Import failed: ' + String((err as any)?.message || err),
      });
    }
  }

  return { handleImportFile };
}
