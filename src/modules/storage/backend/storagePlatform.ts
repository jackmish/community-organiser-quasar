import { Capacitor } from '@capacitor/core';
import type { ElectronAppdataAPI } from './electron/ElectronAppdataAPI';

/** True when running inside a native Capacitor shell (Android / iOS). */
export function isCapacitorNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function hasElectronFileStorage(): boolean {
  if (typeof window === 'undefined') return false;
  const api = (window as Window & { electronAPI?: ElectronAppdataAPI }).electronAPI;
  return !!(
    api &&
    typeof api.getAppDataPath === 'function' &&
    typeof api.writeFile === 'function' &&
    typeof api.joinPath === 'function'
  );
}

/** Use Capacitor sandbox files when Electron appdata is unavailable. */
export function shouldUseCapacitorStorage(): boolean {
  return isCapacitorNative() && !hasElectronFileStorage();
}
