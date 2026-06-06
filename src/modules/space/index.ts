export {
  CO21_SQLITE_DB_FILENAME,
  DEFAULT_SPACE_STORAGE_MODE,
  SYSTEM_SPACE_ID,
  createDefaultSpaceRegistry,
  createSystemSpaceEntry,
  isSystemSpace,
  normalizeSpaceStorageMode,
  type SpaceEntry,
  type SpaceMigrateResult,
  type SpaceRegistry,
  type SpaceRegistrySnapshot,
  type SpaceStorageMode,
  type SpaceType,
} from './models/SpaceModel';

export {
  browseSpaceFolder,
  createCustomSpace,
  isSpaceManagementAvailable,
  loadSpaceRegistrySnapshot,
  migrateSpaceToSqlite,
  openSpaceFolder,
  restartAppForSpaceChanges,
  setDefaultSpace,
  setSpaceStorageMode,
  switchSpaceAndRestart,
  type SpaceElectronAPI,
} from './spaceService';
