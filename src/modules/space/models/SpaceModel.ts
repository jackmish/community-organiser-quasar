export const SYSTEM_SPACE_ID = 'system';

export type SpaceType = 'system' | 'custom';

/** How structured data is persisted inside the space folder. */
export type SpaceStorageMode = 'files' | 'sqlite';

export const DEFAULT_SPACE_STORAGE_MODE: SpaceStorageMode = 'files';

import { CO21_SQLITE_DB_FILENAME } from 'src/modules/storage/appDataPaths';

export { CO21_SQLITE_DB_FILENAME };

/** One switchable data context (folder + isolated settings). */
export interface SpaceEntry {
  id: string;
  name: string;
  type: SpaceType;
  /** Absolute data root — only for custom spaces. */
  dataPath?: string;
  storageMode: SpaceStorageMode;
  /** Set when file data was copied into SQLite (original files kept). */
  sqliteMigratedAt?: string | null;
  createdAt: string;
}

export interface SpaceRegistry {
  activeSpaceId: string;
  /** When set, this space opens on a fresh app launch. Otherwise last accessed (activeSpaceId). */
  defaultSpaceId?: string | null;
  spaces: SpaceEntry[];
}

export interface SpaceRegistrySnapshot {
  registry: SpaceRegistry;
  defaultUserDataPath: string;
  activeDataPath: string;
  activeStorageMode: SpaceStorageMode;
  defaultSpaceId: string | null;
  /** Active custom space folder is missing on disk (moved/deleted). */
  activeSpacePathMissing?: SpacePathIssue | null;
  /** All custom spaces whose folder path is missing. */
  spacePathIssues?: SpacePathIssue[];
}

export type SpacePathIssueKind = 'missing' | 'no_data';

export interface SpacePathIssue {
  spaceId: string;
  name: string;
  expectedPath: string;
  kind: SpacePathIssueKind;
}

export interface SpaceMigrateResult {
  groupCount: number;
  settingsKeyCount: number;
  co21SettingsImported: boolean;
  dbPath: string;
}

export function createSystemSpaceEntry(): SpaceEntry {
  return {
    id: SYSTEM_SPACE_ID,
    name: 'System User',
    type: 'system',
    storageMode: DEFAULT_SPACE_STORAGE_MODE,
    sqliteMigratedAt: null,
    createdAt: '1970-01-01T00:00:00.000Z',
  };
}

export function createDefaultSpaceRegistry(): SpaceRegistry {
  return {
    activeSpaceId: SYSTEM_SPACE_ID,
    defaultSpaceId: null,
    spaces: [createSystemSpaceEntry()],
  };
}

export function isSystemSpace(space: SpaceEntry): boolean {
  return space.type === 'system' || space.id === SYSTEM_SPACE_ID;
}

export function normalizeSpaceStorageMode(value: unknown): SpaceStorageMode {
  return value === 'sqlite' ? 'sqlite' : DEFAULT_SPACE_STORAGE_MODE;
}
