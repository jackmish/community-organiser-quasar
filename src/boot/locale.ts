import { boot } from 'quasar/wrappers';
import { loadSavedLocale } from 'src/modules/lang';

export default boot(async () => {
  await loadSavedLocale();
});
