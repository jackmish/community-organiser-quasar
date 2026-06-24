import { boot } from 'quasar/wrappers';
import { Capacitor } from '@capacitor/core';
import { migrateLegacyWebStorageToCapacitorFiles } from 'src/modules/storage/backend/mobile/capacitorStorageMigration';
import { ensureCapacitorSqliteMigrated } from 'src/modules/storage/backend/mobile/capacitorSqliteMigration';
import { runLoadPhase } from 'src/composables/appLoadProgress';
import logger from 'src/utils/logger';

/** Run before deviceId / loadData so legacy WebView data is on disk first, then SQLite. */
export default boot(async () => {
  await runLoadPhase('storage_migration', async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await migrateLegacyWebStorageToCapacitorFiles();
      const { ensureCapacitorActiveWorkspaceBound } = await import(
        'src/modules/space/capacitorSpaceRegistry'
      );
      await ensureCapacitorActiveWorkspaceBound();
      await ensureCapacitorSqliteMigrated();
    } catch (err) {
      logger.error('[nativeStorageMigration] failed', err);
    }
  });
});
