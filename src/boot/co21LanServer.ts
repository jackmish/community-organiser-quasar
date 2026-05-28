import { boot } from 'quasar/wrappers';
import { ensureCo21LanCapacitorBridge } from 'src/modules/lan/co21LanRuntime';

export default boot(() => {
  ensureCo21LanCapacitorBridge();
});
