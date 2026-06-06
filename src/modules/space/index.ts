export {
  SYSTEM_SPACE_ID,
  createDefaultSpaceRegistry,
  createSystemSpaceEntry,
  isSystemSpace,
  type SpaceEntry,
  type SpaceRegistry,
  type SpaceRegistrySnapshot,
  type SpaceType,
} from './models/SpaceModel';

export {
  browseSpaceFolder,
  createCustomSpace,
  isSpaceManagementAvailable,
  loadSpaceRegistrySnapshot,
  openSpaceFolder,
  switchSpaceAndRestart,
  type SpaceElectronAPI,
} from './spaceService';
