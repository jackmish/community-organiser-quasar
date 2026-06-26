import { loadCo21Settings, patchCo21Settings } from 'src/modules/storage/sync/roleProfileSettings';
import { CO21_SERVER_CHANGED_EVENT, DEFAULT_CO21_SERVER_BASE_URL } from './co21ServerModel';

export async function loadCo21ServerEnabled(): Promise<boolean> {
  const data = await loadCo21Settings();
  return data.aiServerEnabled === true;
}

export async function saveCo21ServerEnabled(enabled: boolean): Promise<boolean> {
  const ok = await patchCo21Settings({ aiServerEnabled: enabled });
  if (ok) {
    window.dispatchEvent(new CustomEvent(CO21_SERVER_CHANGED_EVENT, { detail: { enabled } }));
  }
  return ok;
}

export async function loadCo21ServerBaseUrl(): Promise<string> {
  const data = await loadCo21Settings();
  const raw = typeof data.aiServerBaseUrl === 'string' ? data.aiServerBaseUrl.trim() : '';
  return raw || DEFAULT_CO21_SERVER_BASE_URL;
}

export async function saveCo21ServerBaseUrl(baseUrl: string): Promise<boolean> {
  const trimmed = baseUrl.trim() || DEFAULT_CO21_SERVER_BASE_URL;
  const ok = await patchCo21Settings({ aiServerBaseUrl: trimmed });
  if (ok) {
    window.dispatchEvent(new CustomEvent(CO21_SERVER_CHANGED_EVENT, { detail: { baseUrl: trimmed } }));
  }
  return ok;
}

export async function loadCo21ServerBackendPath(): Promise<string> {
  const data = await loadCo21Settings();
  return typeof data.aiServerBackendPath === 'string' ? data.aiServerBackendPath.trim() : '';
}

export async function saveCo21ServerBackendPath(backendPath: string): Promise<boolean> {
  const ok = await patchCo21Settings({ aiServerBackendPath: backendPath.trim() });
  if (ok) {
    window.dispatchEvent(new CustomEvent(CO21_SERVER_CHANGED_EVENT, { detail: { backendPath } }));
  }
  return ok;
}

/** @deprecated Use loadCo21ServerEnabled */
export const loadAiServerEnabled = loadCo21ServerEnabled;
/** @deprecated Use saveCo21ServerEnabled */
export const saveAiServerEnabled = saveCo21ServerEnabled;
/** @deprecated Use loadCo21ServerBaseUrl */
export const loadAiServerBaseUrl = loadCo21ServerBaseUrl;
/** @deprecated Use saveCo21ServerBaseUrl */
export const saveAiServerBaseUrl = saveCo21ServerBaseUrl;
/** @deprecated Use loadCo21ServerBackendPath */
export const loadAiServerBackendPath = loadCo21ServerBackendPath;
/** @deprecated Use saveCo21ServerBackendPath */
export const saveAiServerBackendPath = saveCo21ServerBackendPath;
