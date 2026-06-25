export const MEDIA_FACE_RECOGNITION_ENABLED_KEY = 'co21.mediaFaceRecognition.enabled';

function readBool(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === '1' || raw === 'true') return true;
    if (raw === '0' || raw === 'false') return false;
  } catch {
    /* ignore */
  }
  return fallback;
}

function writeBool(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function loadMediaFaceRecognitionEnabled(): boolean {
  return readBool(MEDIA_FACE_RECOGNITION_ENABLED_KEY, false);
}

export function saveMediaFaceRecognitionEnabled(enabled: boolean): void {
  writeBool(MEDIA_FACE_RECOGNITION_ENABLED_KEY, enabled);
}
