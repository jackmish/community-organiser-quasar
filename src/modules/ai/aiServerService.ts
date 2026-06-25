import type {
  AiServerDefaultConfig,
  AiServerStatus,
} from './aiServerModel';
import { AI_SERVER_CHANGED_EVENT } from './aiServerModel';
import {
  loadAiServerBackendPath,
  loadAiServerBaseUrl,
  loadAiServerEnabled,
} from './aiServerSettings';

type ElectronAiServerBridge = {
  defaultConfig: (backendPath?: string) => Promise<AiServerDefaultConfig>;
  status: () => Promise<AiServerStatus>;
  health: (baseUrl?: string) => Promise<{ ok: boolean }>;
  start: (payload?: { backendPath?: string; baseUrl?: string }) => Promise<{
    ok: boolean;
    error?: string;
    status?: AiServerStatus;
  }>;
  stop: () => Promise<{ ok: boolean; status: AiServerStatus }>;
};

function bridge(): ElectronAiServerBridge | null {
  const w = window as Window & { electronAiServer?: ElectronAiServerBridge };
  return w.electronAiServer ?? null;
}

export function isAiServerBridgeAvailable(): boolean {
  return bridge() !== null;
}

export async function getAiServerDefaultConfig(): Promise<AiServerDefaultConfig | null> {
  const api = bridge();
  if (!api) return null;
  const customPath = await loadAiServerBackendPath();
  return api.defaultConfig(customPath || undefined);
}

export async function getAiServerStatus(): Promise<AiServerStatus | null> {
  const api = bridge();
  if (!api) return null;
  return api.status();
}

export async function checkAiServerHealth(baseUrl?: string): Promise<boolean> {
  const api = bridge();
  if (!api) return false;
  const res = await api.health(baseUrl);
  return !!res.ok;
}

export async function startAiServerProcess(): Promise<{
  ok: boolean;
  error?: string;
  status?: AiServerStatus;
}> {
  const api = bridge();
  if (!api) return { ok: false, error: 'CO21 backend server is only available in the desktop app.' };

  const [enabled, baseUrl, backendPath] = await Promise.all([
    loadAiServerEnabled(),
    loadAiServerBaseUrl(),
    loadAiServerBackendPath(),
  ]);
  if (!enabled) {
    return { ok: false, error: 'Enable CO21 backend server in Services first.' };
  }

  const payload: { baseUrl: string; backendPath?: string } = { baseUrl };
  if (backendPath) payload.backendPath = backendPath;
  const result = await api.start(payload);
  if (result.ok) {
    window.dispatchEvent(new CustomEvent(AI_SERVER_CHANGED_EVENT, { detail: { running: true } }));
  }
  return result;
}

export async function stopAiServerProcess(): Promise<AiServerStatus | null> {
  const api = bridge();
  if (!api) return null;
  const result = await api.stop();
  window.dispatchEvent(new CustomEvent(AI_SERVER_CHANGED_EVENT, { detail: { running: false } }));
  return result.status;
}

export async function ensureAiServerRunning(): Promise<{
  ok: boolean;
  error?: string;
  status?: AiServerStatus | null;
}> {
  const status = await getAiServerStatus();
  if (status?.running) {
    const healthy = await checkAiServerHealth(status.baseUrl);
    if (healthy) return { ok: true, status };
  }

  const externalHealthy = await checkAiServerHealth(await loadAiServerBaseUrl());
  if (externalHealthy) {
    return { ok: true, status: await getAiServerStatus() };
  }

  return startAiServerProcess();
}
