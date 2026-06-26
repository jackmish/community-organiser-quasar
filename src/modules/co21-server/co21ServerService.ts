import type { Co21ServerDefaultConfig, Co21ServerStatus } from './co21ServerModel';
import { CO21_SERVER_CHANGED_EVENT } from './co21ServerModel';
import {
  loadCo21ServerBackendPath,
  loadCo21ServerBaseUrl,
  loadCo21ServerEnabled,
} from './co21ServerSettings';

type ElectronCo21ServerBridge = {
  defaultConfig: (backendPath?: string) => Promise<Co21ServerDefaultConfig>;
  status: () => Promise<Co21ServerStatus>;
  health: (baseUrl?: string) => Promise<{ ok: boolean }>;
  start: (payload?: { backendPath?: string; baseUrl?: string }) => Promise<{
    ok: boolean;
    error?: string;
    status?: Co21ServerStatus;
  }>;
  stop: () => Promise<{ ok: boolean; status: Co21ServerStatus }>;
};

function bridge(): ElectronCo21ServerBridge | null {
  const w = window as Window & { electronAiServer?: ElectronCo21ServerBridge };
  return w.electronAiServer ?? null;
}

export function isCo21ServerBridgeAvailable(): boolean {
  return bridge() !== null;
}

export async function getCo21ServerDefaultConfig(): Promise<Co21ServerDefaultConfig | null> {
  const api = bridge();
  if (!api) return null;
  const customPath = await loadCo21ServerBackendPath();
  return api.defaultConfig(customPath || undefined);
}

export async function getCo21ServerStatus(): Promise<Co21ServerStatus | null> {
  const api = bridge();
  if (!api) return null;
  return api.status();
}

export async function checkCo21ServerHealth(baseUrl?: string): Promise<boolean> {
  const api = bridge();
  if (!api) return false;
  const res = await api.health(baseUrl);
  return !!res.ok;
}

export async function startCo21ServerProcess(): Promise<{
  ok: boolean;
  error?: string;
  status?: Co21ServerStatus;
}> {
  const api = bridge();
  if (!api) return { ok: false, error: 'CO21 backend server is only available in the desktop app.' };

  const [enabled, baseUrl, backendPath] = await Promise.all([
    loadCo21ServerEnabled(),
    loadCo21ServerBaseUrl(),
    loadCo21ServerBackendPath(),
  ]);
  if (!enabled) {
    return { ok: false, error: 'Enable CO21 backend server in Services first.' };
  }

  const payload: { baseUrl: string; backendPath?: string } = { baseUrl };
  if (backendPath) payload.backendPath = backendPath;
  const result = await api.start(payload);
  if (result.ok) {
    window.dispatchEvent(new CustomEvent(CO21_SERVER_CHANGED_EVENT, { detail: { running: true } }));
  }
  return result;
}

export async function stopCo21ServerProcess(): Promise<Co21ServerStatus | null> {
  const api = bridge();
  if (!api) return null;
  const result = await api.stop();
  window.dispatchEvent(new CustomEvent(CO21_SERVER_CHANGED_EVENT, { detail: { running: false } }));
  return result.status;
}

export async function ensureCo21ServerRunning(): Promise<{
  ok: boolean;
  error?: string;
  status?: Co21ServerStatus | null;
}> {
  const status = await getCo21ServerStatus();
  if (status?.running) {
    const healthy = await checkCo21ServerHealth(status.baseUrl);
    if (healthy) return { ok: true, status };
  }

  const externalHealthy = await checkCo21ServerHealth(await loadCo21ServerBaseUrl());
  if (externalHealthy) {
    return { ok: true, status: await getCo21ServerStatus() };
  }

  return startCo21ServerProcess();
}

/** @deprecated Use isCo21ServerBridgeAvailable */
export const isAiServerBridgeAvailable = isCo21ServerBridgeAvailable;
/** @deprecated Use getCo21ServerDefaultConfig */
export const getAiServerDefaultConfig = getCo21ServerDefaultConfig;
/** @deprecated Use getCo21ServerStatus */
export const getAiServerStatus = getCo21ServerStatus;
/** @deprecated Use checkCo21ServerHealth */
export const checkAiServerHealth = checkCo21ServerHealth;
/** @deprecated Use startCo21ServerProcess */
export const startAiServerProcess = startCo21ServerProcess;
/** @deprecated Use stopCo21ServerProcess */
export const stopAiServerProcess = stopCo21ServerProcess;
/** @deprecated Use ensureCo21ServerRunning */
export const ensureAiServerRunning = ensureCo21ServerRunning;
