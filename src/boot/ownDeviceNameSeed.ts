import { boot } from 'quasar/wrappers';
import { runLoadPhase } from 'src/composables/appLoadProgress';
import { maybeSeedOwnDeviceNameFromHost } from 'src/modules/storage/sync/deviceRoleAssignment';

/** Once per install: use Windows PC name / hostname when ownDeviceName was never set. */
export default boot(() => {
  void runLoadPhase('app_services', () => maybeSeedOwnDeviceNameFromHost());
});
