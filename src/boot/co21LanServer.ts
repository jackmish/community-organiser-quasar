import { boot } from 'quasar/wrappers';
import { ensureCo21LanCapacitorBridge, getCo21LanApi, hasCo21LanServer } from 'src/modules/lan/co21LanRuntime';

export default boot(() => {
  ensureCo21LanCapacitorBridge();

  // Expose unified API for code that still checks window.electronLan.
  if (typeof window !== 'undefined' && !hasCo21LanServer()) {
    return;
  }
  const api = getCo21LanApi();
  if (!api) return;
  const w = window as Window & { electronLan?: typeof api };
  if (!w.electronLan?.startServer) {
    w.electronLan = api;
  }
});
