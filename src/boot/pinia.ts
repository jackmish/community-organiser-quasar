import { boot } from 'quasar/wrappers';
import { createPinia } from 'pinia';
import { initApi } from 'src/modules/day-organiser/apiRoot';

export default boot(({ app }) => {
  app.use(createPinia());
  // Eagerly construct the storage module so `saveData()` can always resolve
  // `app('storage')` – even before any component first accesses `api.storage`.
  initApi();
});
