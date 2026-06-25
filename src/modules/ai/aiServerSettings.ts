import { loadCo21Settings, patchCo21Settings } from 'src/modules/storage/sync/roleProfileSettings';
import { AI_SERVER_CHANGED_EVENT, DEFAULT_AI_SERVER_BASE_URL } from './aiServerModel';

export async function loadAiServerEnabled(): Promise<boolean> {
  const data = await loadCo21Settings();
  return data.aiServerEnabled === true;
}

export async function saveAiServerEnabled(enabled: boolean): Promise<boolean> {
  const ok = await patchCo21Settings({ aiServerEnabled: enabled });
  if (ok) {
    window.dispatchEvent(new CustomEvent(AI_SERVER_CHANGED_EVENT, { detail: { enabled } }));
  }
  return ok;
}

export async function loadAiServerBaseUrl(): Promise<string> {
  const data = await loadCo21Settings();
  const raw = typeof data.aiServerBaseUrl === 'string' ? data.aiServerBaseUrl.trim() : '';
  return raw || DEFAULT_AI_SERVER_BASE_URL;
}

export async function saveAiServerBaseUrl(baseUrl: string): Promise<boolean> {
  const trimmed = baseUrl.trim() || DEFAULT_AI_SERVER_BASE_URL;
  const ok = await patchCo21Settings({ aiServerBaseUrl: trimmed });
  if (ok) {
    window.dispatchEvent(new CustomEvent(AI_SERVER_CHANGED_EVENT, { detail: { baseUrl: trimmed } }));
  }
  return ok;
}

export async function loadAiServerBackendPath(): Promise<string> {
  const data = await loadCo21Settings();
  return typeof data.aiServerBackendPath === 'string' ? data.aiServerBackendPath.trim() : '';
}

export async function saveAiServerBackendPath(backendPath: string): Promise<boolean> {
  const ok = await patchCo21Settings({ aiServerBackendPath: backendPath.trim() });
  if (ok) {
    window.dispatchEvent(new CustomEvent(AI_SERVER_CHANGED_EVENT, { detail: { backendPath } }));
  }
  return ok;
}
