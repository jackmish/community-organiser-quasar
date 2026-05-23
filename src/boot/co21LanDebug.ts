import { boot } from 'quasar/wrappers';
import { Capacitor } from '@capacitor/core';
import {
  getLanDebugBuildInfo,
  isLanDebugCaptureActive,
  lanDebugNote,
  setLanDebugForceCapture,
} from 'src/modules/lan/lanDebugLog';

export default boot(() => {
  if (import.meta.env.CO21_LAN_DEBUG === '0') return;
  if (Capacitor.isNativePlatform()) {
    setLanDebugForceCapture(true);
  }
  if (isLanDebugCaptureActive()) {
    lanDebugNote('LAN debug ready', getLanDebugBuildInfo());
  }
});
