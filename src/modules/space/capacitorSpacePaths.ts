import {
  APP_DATA_PATH_SEGMENTS,
  CO21_SQLITE_DB_FILENAME,
} from 'src/modules/storage/appDataPaths';
import {
  isSystemSpace,
  SYSTEM_SPACE_ID,
  type SpaceEntry,
  type SpaceRegistry,
} from './models/SpaceModel';

/** Custom workspaces live under Directory.Data / spaces / {id} */
export const CAPACITOR_SPACES_DIR = 'spaces';

export const CAPACITOR_REGISTRY_PATH = [
  ...APP_DATA_PATH_SEGMENTS.co21Config,
  'spaces-registry.json',
].join('/');

export function getCapacitorDefaultDataRootLabel(): string {
  return 'app data';
}

export function capacitorWorkspaceRootForSpace(space: SpaceEntry): string {
  if (isSystemSpace(space)) return '';
  return space.dataPath?.trim() || '';
}

export function joinCapacitorWorkspacePath(workspaceRoot: string, ...segments: string[]): string {
  return [workspaceRoot, ...segments].filter((s) => s.length > 0).join('/');
}

export function capacitorSqliteRelativePath(workspaceRoot: string): string {
  return joinCapacitorWorkspacePath(
    workspaceRoot,
    ...APP_DATA_PATH_SEGMENTS.sqlite,
    CO21_SQLITE_DB_FILENAME,
  );
}

export function resolveCapacitorActiveWorkspaceRoot(registry: SpaceRegistry): string {
  const active = registry.spaces.find((s) => s.id === registry.activeSpaceId);
  if (!active || isSystemSpace(active)) return '';
  return active.dataPath?.trim() || '';
}

export function resolveCapacitorDataPathForSpace(space: SpaceEntry): string {
  return capacitorWorkspaceRootForSpace(space);
}

export function isCapacitorSystemSpaceId(spaceId: string): boolean {
  return spaceId === SYSTEM_SPACE_ID;
}

export function sqliteDbNameForCapacitorWorkspace(workspaceRoot: string): string {
  if (!workspaceRoot) return CO21_SQLITE_DB_FILENAME.replace(/\.db$/i, '');
  const id = workspaceRoot.replace(/^spaces\//, '').replace(/-/g, '');
  return `co21_${id.slice(0, 32)}`;
}
