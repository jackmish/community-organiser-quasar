import { boot } from 'quasar/wrappers';
import { runLoadPhase } from 'src/composables/appLoadProgress';
import { deviceId } from 'src/modules/storage/sync/deviceId';
import { loadCo21Settings, patchCo21Settings } from 'src/modules/storage/sync/roleProfileSettings';

/** Persist installation device id in co21 settings (used for sync contracts + LAN /info). */
export default boot(() =>
  runLoadPhase('app_services', () => {
  deviceId.init(
    async (key, fallback) => {
      const data = await loadCo21Settings();
      const v = (data as Record<string, unknown>)[key];
      return typeof v === 'string' && v.length > 0 ? v : fallback;
    },
    async (key, value) => {
      await patchCo21Settings({ [key]: value });
    },
  );
  }),
);
