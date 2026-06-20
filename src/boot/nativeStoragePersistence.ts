import { boot } from 'quasar/wrappers';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { runLoadPhase } from 'src/composables/appLoadProgress';
import { saveData } from 'src/utils/storageUtils';
import logger from 'src/utils/logger';

/** Flush organiser data when Android/iOS sends the app to background. */
export default boot(async () => {
  await runLoadPhase('app_services', async () => {
  if (!Capacitor.isNativePlatform()) return;

  const flush = () => {
    void saveData().catch((err) => {
      logger.error('[nativeStoragePersistence] save failed', err);
    });
  };

  try {
    await App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) flush();
    });
  } catch (err) {
    logger.warn('[nativeStoragePersistence] appStateChange listener unavailable', err);
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
  }
  });
});
