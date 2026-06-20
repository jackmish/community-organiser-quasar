import { boot } from 'quasar/wrappers';
import { Capacitor } from '@capacitor/core';
import { migrateLegacyWebStorageToCapacitorFiles } from 'src/modules/storage/backend/mobile/capacitorStorageMigration';
import { runLoadPhase } from 'src/composables/appLoadProgress';
import logger from 'src/utils/logger';

/** Run before deviceId / loadData so legacy WebView data is on disk first. */
export default boot(async () => {
  await runLoadPhase('storage_migration', async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await migrateLegacyWebStorageToCapacitorFiles();
    } catch (err) {
      logger.error('[nativeStorageMigration] failed', err);
    }
  });
});
