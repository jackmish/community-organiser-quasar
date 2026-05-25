/**
 * User module — public API surface.
 *
 * Other modules and plugins access user data through CC.user or by importing
 * from this barrel file:
 *
 *   import { useUser } from 'src/modules/user';
 *   const user = useUser();          // Pinia-backed controller
 *   user.identifier                  // email or device id
 *   user.isGoogleConnected           // boolean computed
 *   user.googleFeatures              // ['auth', 'calendar']
 */
export { UserStoreController, type UserControllerInstance } from './UserController';
export type {
  UserProfile,
  Co21Account,
  GoogleAccountLink,
  GoogleFeature,
} from './models/UserAccount';

export { UserStoreController as useUser } from './UserController';
export {
  signInWithGoogle,
  getAccessToken,
  clearGoogleTokens,
} from './googleAuthService';

export {
  checkAndSync,
  runSync,
  startSyncScheduler,
  stopSyncScheduler,
} from './calendarSyncService';
