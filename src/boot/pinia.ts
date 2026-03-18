import { boot } from 'quasar/wrappers';
import { createPinia } from 'pinia';

import { loadPluginsFromManifest } from 'src/plugins/pluginLoader';
import { registerPlugins, getPiniaPlugins } from 'src/plugins/pluginRegistry';
import CC from 'src/CentralController';

export default boot(async ({ app }) => {
  // Load plugins from manifest — resolves IDs to bundled modules
  const plugins = await loadPluginsFromManifest();
  registerPlugins(plugins);

  const pinia = createPinia();

  // Wire Pinia plugins before initApi() so they are active when stores are first created
  getPiniaPlugins().forEach((p) => pinia.use(p));

  app.use(pinia);
  // Eagerly construct the storage module so `saveData()` can always resolve
  // `app('storage')` – even before any component first accesses `api.storage`.
  CC.initControllers();
});
