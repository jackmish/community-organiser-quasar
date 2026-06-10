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
  type SpacePathIssue,
  type SpacePathIssueKind,
  type SpaceRegistry,
  type SpaceRegistrySnapshot,
  type SpaceStorageMode,
  type SpaceType,
} from './models/SpaceModel';

export {
  CO21_WORKSPACE_DIR_NAME,
  isWorkspaceCreateMode,
  type WorkspaceBrowseKind,
  type WorkspaceCreateMode,
} from './models/workspaceSetupModel';

export {
  browseSpaceFolder,
  createCustomSpace,
  createWorkspaceWithSetup,
  isSpaceManagementAvailable,
  loadSpaceRegistrySnapshot,
  migrateSpaceToSqlite,
  openSpaceFolder,
  registerExistingCustomSpace,
  relocateCustomSpaceFolder,
  moveCustomSpaceFolder,
  removeWorkspaceFromRegistry,
  skipBrokenActiveWorkspace,
  restartAppForSpaceChanges,
  setDefaultSpace,
  setSpaceStorageMode,
  switchAwayFromBrokenWorkspaceAndRestart,
  switchSpaceAndRestart,
  type SpaceElectronAPI,
} from './spaceService';

export {
  dispatchOpenConnectionsDialog,
  dispatchOpenSpacesDialog,
  OPEN_CONNECTIONS_DIALOG_EVENT,
  OPEN_SPACES_DIALOG_EVENT,
  type OpenSpacesDialogDetail,
  type OpenSpacesDialogMode,
} from './spaceUi';

export {
  disableActiveSpaceAccess,
  isSpaceAccessAvailable,
  loadActiveSpaceAccessStatus,
  loadAllSpacesAccessStatus,
  setActiveSpaceAccessPassword,
  setSimpleSpaceAccessEnabled,
  verifyActiveSpacePassword,
} from './spaceAccessService';

export type { SpaceAccessStatus, SpaceAccessMethod, SpaceAccessFile } from './spaceAccessModel';
