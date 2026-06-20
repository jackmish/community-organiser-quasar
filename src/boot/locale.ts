import { boot } from 'quasar/wrappers';
import { runLoadPhase } from 'src/composables/appLoadProgress';
import { loadSavedLocale } from 'src/modules/lang';

export default boot(async () => {
  await runLoadPhase('app_services', () => loadSavedLocale());
});
