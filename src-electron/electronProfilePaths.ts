import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import logger from 'src/utils/logger';
import { CO21_SQLITE_DB_FILENAME } from '../src/modules/storage/appDataPaths';
import { migrateCo21ConfigDirAtRoot } from './dataLayoutMigration';

const CHROMIUM_PROFILE_DIR = 'app-data';
const LEGACY_CHROMIUM_PROFILE_DIR = 'app';

/** Chromium/Electron profile entries moved under profileRoot/app-data. */
const CHROMIUM_ROOT_ENTRIES = [
  'Cache',
  'GPUCache',
  'Code Cache',
  'Crashpad',
  'Dictionaries',
  'DawnCache',
  'DawnGraphiteCache',
  'DawnWebGPUCache',
  'Local Storage',
  'Session Storage',
  'IndexedDB',
  'Shared Dictionary',
  'SharedStorage',
  'blob_storage',
  'Network Persistent State',
  'Preferences',
  'TransportSecurity',
  'Trust Tokens',
  'Trust Tokens-journal',
  'WebStorage',
  'DIPS',
  'Extension State',
  'Local Extension Settings',
  'Sync Data',
  'Service Worker',
  'Cookies',
  'Cookies-journal',
  'VideoDecodeStats',
  'Visited Links',
  'Top Sites',
  'Favicons',
  'Favicons-journal',
  'History',
  'History-journal',
  'QuotaManager',
  'QuotaManager-journal',
  'SharedStorage-wal',
] as const;

/** CO21 data that must stay at the profile root (system space). */
const RESERVED_PROFILE_ROOT_ENTRIES = new Set<string>([
  'co21-config',
  'workspace',
  'storage',
  'app-data',
  'holidays',
  'meteo',
  'cache',
  CO21_SQLITE_DB_FILENAME,
  `${CO21_SQLITE_DB_FILENAME}-wal`,
  `${CO21_SQLITE_DB_FILENAME}-shm`,
]);

let co21ProfileRoot: string | undefined;

function mergeDirectoryContents(srcDir: string, destDir: string): void {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir)) {
    const from = path.join(srcDir, entry);
    const to = path.join(destDir, entry);
    if (fs.existsSync(to)) {
      const fromStat = fs.statSync(from);
      const toStat = fs.statSync(to);
      if (fromStat.isDirectory() && toStat.isDirectory()) {
        mergeDirectoryContents(from, to);
        fs.rmSync(from, { recursive: true, force: true });
      }
      continue;
    }
    fs.renameSync(from, to);
  }
}

function removePathIfExists(targetPath: string): void {
  if (!fs.existsSync(targetPath)) return;
  fs.rmSync(targetPath, { recursive: true, force: true });
}

/** Move profile-root chromium clutter into app/, removing stale duplicates at the root. */
function relocateProfileEntry(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.renameSync(src, dest);
    return;
  }

  const srcStat = fs.statSync(src);
  const destStat = fs.statSync(dest);
  if (srcStat.isDirectory() && destStat.isDirectory()) {
    mergeDirectoryContents(src, dest);
    removePathIfExists(src);
    return;
  }

  // Canonical copy already lives under app-data/ — drop the profile-root duplicate.
  removePathIfExists(src);
}

function migrateChromiumEntriesToAppFolder(profileRoot: string, chromiumDir: string): void {
  fs.mkdirSync(chromiumDir, { recursive: true });
  for (const name of CHROMIUM_ROOT_ENTRIES) {
    const src = path.join(profileRoot, name);
    const dest = path.join(chromiumDir, name);
    try {
      relocateProfileEntry(src, dest);
    } catch (e) {
      logger.warn('[electronProfile] could not move chromium entry', name, e);
    }
  }
}

/** Move any remaining profile-root entries that are not CO21 workspace data. */
function sweepOrphanedChromiumEntries(profileRoot: string, chromiumDir: string): void {
  let entries: string[];
  try {
    entries = fs.readdirSync(profileRoot);
  } catch {
    return;
  }
  fs.mkdirSync(chromiumDir, { recursive: true });
  for (const name of entries) {
    if (RESERVED_PROFILE_ROOT_ENTRIES.has(name)) continue;
    const src = path.join(profileRoot, name);
    const dest = path.join(chromiumDir, name);
    try {
      relocateProfileEntry(src, dest);
    } catch (e) {
      logger.warn('[electronProfile] could not sweep chromium entry', name, e);
    }
  }
}

/** Relocate Chromium profile clutter into profileRoot/app-data (testable without Electron). */
export function migrateChromiumProfileLayout(profileRoot: string, chromiumDir: string): void {
  migrateChromiumEntriesToAppFolder(profileRoot, chromiumDir);
  sweepOrphanedChromiumEntries(profileRoot, chromiumDir);
}

export function migrateLegacyChromiumProfileDir(profileRoot: string): string {
  const chromiumDir = path.join(profileRoot, CHROMIUM_PROFILE_DIR);
  const legacyDir = path.join(profileRoot, LEGACY_CHROMIUM_PROFILE_DIR);
  try {
    relocateProfileEntry(legacyDir, chromiumDir);
  } catch (e) {
    logger.warn('[electronProfile] could not migrate legacy app profile dir', e);
  }
  return chromiumDir;
}

function isChromiumProfileDirName(name: string): boolean {
  return name === CHROMIUM_PROFILE_DIR || name === LEGACY_CHROMIUM_PROFILE_DIR;
}

/**
 * Keep CO21 data at the OS profile root while isolating Chromium caches under `app-data/`.
 * Must run before `app.whenReady()`.
 */
export function configureElectronProfilePaths(): void {
  if (co21ProfileRoot) return;

  const profileRoot = app.getPath('userData');
  if (isChromiumProfileDirName(path.basename(profileRoot))) {
    co21ProfileRoot = path.dirname(profileRoot);
    if (path.basename(profileRoot) === LEGACY_CHROMIUM_PROFILE_DIR) {
      const targetDir = path.join(co21ProfileRoot, CHROMIUM_PROFILE_DIR);
      try {
        relocateProfileEntry(profileRoot, targetDir);
        app.setPath('userData', targetDir);
      } catch (e) {
        logger.warn('[electronProfile] could not relocate legacy chromium userData', e);
      }
    }
    return;
  }

  migrateCo21ConfigDirAtRoot(profileRoot);
  const chromiumDir = migrateLegacyChromiumProfileDir(profileRoot);
  migrateChromiumProfileLayout(profileRoot, chromiumDir);
  app.setPath('userData', chromiumDir);
  co21ProfileRoot = profileRoot;
}

/** CO21 profile root (registry + system space data). Not the Chromium userData path. */
export function getCo21ProfileRoot(): string {
  if (co21ProfileRoot) return co21ProfileRoot;
  const currentUserData = app.getPath('userData');
  const parent = path.dirname(currentUserData);
  const base = path.basename(currentUserData);
  if (isChromiumProfileDirName(base)) return parent;
  return currentUserData;
}
