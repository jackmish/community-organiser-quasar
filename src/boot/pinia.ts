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
  // Eagerly construct all registered controllers and wire storage ports + lifecycle hooks.
  CC.boot();
});
