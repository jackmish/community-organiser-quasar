import type { SpaceAccessStatus } from './spaceAccessModel';

type Ok<T> = { ok: true } & T;
type Err = { ok: false; error: string };

export interface SpaceAccessElectronAPI {
  getStatus: () => Promise<SpaceAccessStatus>;
  verify: (password: string) => Promise<Ok<{ verified: boolean }> | Err>;
  setPassword: (payload: { password: string; currentPassword?: string }) => Promise<
    Ok<{ status: SpaceAccessStatus }> | Err
  >;
  disable: (payload: { currentPassword: string }) => Promise<Ok<{ status: SpaceAccessStatus }> | Err>;
}

function accessApi(): SpaceAccessElectronAPI | null {
  const api = (window as unknown as { electronSpaceAccess?: SpaceAccessElectronAPI })
    .electronSpaceAccess;
  if (!api || typeof api.getStatus !== 'function') return null;
  return api;
}

export function isSpaceAccessAvailable(): boolean {
  return accessApi() !== null;
}

export function isElectronApp(): boolean {
  const w = window as unknown as {
    electronAPI?: { isPreloadWorking?: () => boolean };
  };
  return typeof w.electronAPI?.isPreloadWorking === 'function' && w.electronAPI.isPreloadWorking();
}

export async function loadActiveSpaceAccessStatus(): Promise<SpaceAccessStatus | null> {
  const api = accessApi();
  if (!api) return null;
  return api.getStatus();
}

export async function verifyActiveSpacePassword(password: string): Promise<boolean> {
  const api = accessApi();
  if (!api) return true;
  const result = await api.verify(password);
  if (!result.ok) throw new Error(result.error);
  return result.verified;
}

export async function setActiveSpaceAccessPassword(
  password: string,
  currentPassword?: string,
): Promise<SpaceAccessStatus> {
  const api = accessApi();
  if (!api) throw new Error('Space access is only available in the desktop app');
  const result = await api.setPassword(
    currentPassword !== undefined ? { password, currentPassword } : { password },
  );
  if (!result.ok) throw new Error(result.error);
  return result.status;
}

export async function disableActiveSpaceAccess(currentPassword: string): Promise<SpaceAccessStatus> {
  const api = accessApi();
  if (!api) throw new Error('Space access is only available in the desktop app');
  const result = await api.disable({ currentPassword });
  if (!result.ok) throw new Error(result.error);
  return result.status;
}
