import { boot } from 'quasar/wrappers';
import { runLoadPhase } from 'src/composables/appLoadProgress';
import { ensureCo21LanCapacitorBridge } from 'src/modules/lan/co21LanRuntime';

export default boot(() => {
  runLoadPhase('app_services', () => ensureCo21LanCapacitorBridge());
});
