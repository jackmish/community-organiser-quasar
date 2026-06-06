import type {
  SpaceEntry,
  SpaceMigrateResult,
  SpaceRegistrySnapshot,
  SpaceStorageMode,
} from './models/SpaceModel';

type SpaceOkResult<T> = { ok: true } & T;
type SpaceErrResult = { ok: false; error: string };

type SpaceCreateResult = SpaceOkResult<{ entry: SpaceEntry }> | SpaceErrResult;
type SpaceSwitchResult = SpaceOkResult<Record<string, never>> | SpaceErrResult;
type SpaceOpenFolderResult = SpaceOkResult<Record<string, never>> | SpaceErrResult;
type SpaceSetModeResult = SpaceOkResult<{ space: SpaceEntry }> | SpaceErrResult;
type SpaceMigrateResultPayload = SpaceOkResult<{
  space: SpaceEntry;
  result: SpaceMigrateResult;
}> | SpaceErrResult;

export interface SpaceElectronAPI {
  getRegistry: () => Promise<SpaceRegistrySnapshot>;
  createSpace: (payload: { name: string; dataPath: string }) => Promise<SpaceCreateResult>;
  switchAndRestart: (spaceId: string) => Promise<SpaceSwitchResult>;
  openFolder: (folderPath: string) => Promise<SpaceOpenFolderResult>;
  setStorageMode: (payload: {
    spaceId: string;
    mode: SpaceStorageMode;
  }) => Promise<SpaceSetModeResult>;
  migrateToSqlite: (spaceId: string) => Promise<SpaceMigrateResultPayload>;
  restartApp: () => Promise<SpaceOkResult<Record<string, never>> | SpaceErrResult>;
  setDefaultSpace: (spaceId: string | null) => Promise<
    SpaceOkResult<{ defaultSpaceId: string | null }> | SpaceErrResult
  >;
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

export async function setSpaceStorageMode(
  spaceId: string,
  mode: SpaceStorageMode,
): Promise<SpaceEntry> {
  const api = spaceApi();
  if (!api) throw new Error('Space management is only available in the desktop app');
  const result = await api.setStorageMode({ spaceId, mode });
  if (!result.ok) throw new Error(result.error);
  return result.space;
}

export async function migrateSpaceToSqlite(
  spaceId: string,
): Promise<{ space: SpaceEntry; result: SpaceMigrateResult }> {
  const api = spaceApi();
  if (!api) throw new Error('Space management is only available in the desktop app');
  const result = await api.migrateToSqlite(spaceId);
  if (!result.ok) throw new Error(result.error);
  return { space: result.space, result: result.result };
}

export async function restartAppForSpaceChanges(): Promise<void> {
  const api = spaceApi();
  if (!api) throw new Error('Space management is only available in the desktop app');
  const result = await api.restartApp();
  if (!result.ok) throw new Error(result.error);
}

export async function browseSpaceFolder(): Promise<string | null> {
  const api = (window as unknown as { electronAPI?: { showOpenFolder?: () => Promise<string | null> } })
    .electronAPI;
  if (!api || typeof api.showOpenFolder !== 'function') return null;
  return api.showOpenFolder();
}

export async function setDefaultSpace(spaceId: string | null): Promise<string | null> {
  const api = spaceApi();
  if (!api) throw new Error('Space management is only available in the desktop app');
  const result = await api.setDefaultSpace(spaceId);
  if (!result.ok) throw new Error(result.error);
  return result.defaultSpaceId;
}

export async function openSpaceFolder(folderPath: string): Promise<void> {
  const api = spaceApi();
  if (!api) throw new Error('Space management is only available in the desktop app');
  const result = await api.openFolder(folderPath);
  if (!result.ok) throw new Error(result.error);
}
