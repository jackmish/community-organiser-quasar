import { noteCo21ServerBootId } from 'src/modules/co21-server/co21ApiClient';
import { clearAllStoredPendingDetections } from './recognitionPendingStorage';

const listeners = new Set<() => void>();

export function subscribeRecognitionServerRestart(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Returns true when the backend process has restarted since the last check. */
export async function notifyRecognitionServerBootIfChanged(): Promise<boolean> {
  const restarted = await noteCo21ServerBootId();
  if (!restarted) return false;
  clearAllStoredPendingDetections();
  listeners.forEach((listener) => listener());
  return true;
}
