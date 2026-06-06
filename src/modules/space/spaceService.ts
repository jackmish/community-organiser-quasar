import type { SpaceEntry, SpaceRegistrySnapshot } from './models/SpaceModel';

type SpaceCreateResult =
  | { ok: true; entry: SpaceEntry }
  | { ok: false; error: string };

type SpaceSwitchResult = { ok: true } | { ok: false; error: string };
type SpaceOpenFolderResult = { ok: true } | { ok: false; error: string };

export interface SpaceElectronAPI {
  getRegistry: () => Promise<SpaceRegistrySnapshot>;
  createSpace: (payload: { name: string; dataPath: string }) => Promise<SpaceCreateResult>;
  switchAndRestart: (spaceId: string) => Promise<SpaceSwitchResult>;
  openFolder: (folderPath: string) => Promise<SpaceOpenFolderResult>;
}

function spaceApi(): SpaceElectronAPI | null {
  const api = (window as unknown as { electronSpace?: SpaceElectronAPI }).electronSpace;
  if (!api || typeof api.getRegistry !== 'function') return null;
  return api;
}

export function isSpaceManagementAvailable(): boolean {
  return spaceApi() !== null;
}

export async function loadSpaceRegistrySnapshot(): Promise<SpaceRegistrySnapshot | null> {
  const api = spaceApi();
  if (!api) return null;
  return api.getRegistry();
}

export async function createCustomSpace(name: string, dataPath: string): Promise<SpaceEntry> {
  const api = spaceApi();
  if (!api) throw new Error('Space management is only available in the desktop app');
  const result = await api.createSpace({ name, dataPath });
  if (!result.ok) throw new Error(result.error);
  return result.entry;
}

export async function switchSpaceAndRestart(spaceId: string): Promise<void> {
  const api = spaceApi();
  if (!api) throw new Error('Space management is only available in the desktop app');
  const result = await api.switchAndRestart(spaceId);
  if (!result.ok) throw new Error(result.error);
}

export async function browseSpaceFolder(): Promise<string | null> {
  const api = (window as unknown as { electronAPI?: { showOpenFolder?: () => Promise<string | null> } })
    .electronAPI;
  if (!api || typeof api.showOpenFolder !== 'function') return null;
  return api.showOpenFolder();
}

export async function openSpaceFolder(folderPath: string): Promise<void> {
  const api = spaceApi();
  if (!api) throw new Error('Space management is only available in the desktop app');
  const result = await api.openFolder(folderPath);
  if (!result.ok) throw new Error(result.error);
}
