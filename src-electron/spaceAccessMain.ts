import fs from 'fs';
import path from 'path';
import os from 'os';
import { app } from 'electron';
import { createHash } from 'node:crypto';
import type { SpaceAccessFile, SpaceAccessStatus } from '../src/modules/space/spaceAccessModel';
import {
  loadSpaceRegistrySnapshot,
  resolveActiveDataPath,
  resolveActiveSpaceContext,
  resolveActiveStorageMode,
} from './spaceRegistryMain';
import { loadAppSettingsFromSqlite, sqliteDbExists } from './spaceSqliteMain';

const ACCESS_FILE = 'space-access.json';
const DEVICE_ACCESS_FILE = 'device-space-access.json';
const LEGACY_ACCESS_FILE = path.join('co21', ACCESS_FILE);
const PROFILE_SETTINGS_KEY = 'co21_user_profile';

function hashPassword(plain: string): string {
  return createHash('sha256').update(plain, 'utf8').digest('hex');
}

function resolveLocalDeviceKey(): string {
  const seed = `${os.hostname()}|${app.getPath('userData')}`;
  return createHash('sha256').update(seed, 'utf8').digest('hex').slice(0, 16);
}

function canonicalAccessFilePath(dataPath: string): string {
  return path.join(dataPath, 'co21', 'access', DEVICE_ACCESS_FILE);
}

function hashedAccessFilePath(dataPath: string): string {
  return path.join(dataPath, 'co21', 'access', resolveLocalDeviceKey(), ACCESS_FILE);
}

function legacyAccessFilePath(dataPath: string): string {
  return path.join(dataPath, LEGACY_ACCESS_FILE);
}

function readJsonObject(filePath: string): Record<string, unknown> | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    if (!raw.trim()) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function loadAppSettingsFromFiles(dataPath: string): Record<string, unknown> {
  return readJsonObject(path.join(dataPath, 'storage', 'settings.json')) ?? {};
}

function loadAppSettingsForSpace(dataPath: string): Record<string, unknown> {
  const storageMode = resolveActiveStorageMode();
  if (storageMode === 'sqlite' && sqliteDbExists(dataPath)) {
    try {
      return loadAppSettingsFromSqlite(dataPath);
    } catch {
      return loadAppSettingsFromFiles(dataPath);
    }
  }
  return loadAppSettingsFromFiles(dataPath);
}

/** CO21 account password from Services → stored in active space app settings. */
function readCo21ProfilePasswordHash(dataPath: string): string | null {
  const settings = loadAppSettingsForSpace(dataPath);
  const profile = settings[PROFILE_SETTINGS_KEY];
  if (!profile || typeof profile !== 'object') return null;
  const co21 = (profile as { co21?: { passwordHash?: unknown } }).co21;
  const hash = typeof co21?.passwordHash === 'string' ? co21.passwordHash.trim() : '';
  return hash || null;
}

function parseAccessFile(raw: string): SpaceAccessFile | null {
  try {
    if (!raw.trim()) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const obj = parsed as Partial<SpaceAccessFile>;
    if (typeof obj.enabled !== 'boolean') return null;
    return {
      enabled: obj.enabled,
      method: 'password',
      passwordHash: typeof obj.passwordHash === 'string' ? obj.passwordHash : null,
      updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function readAccessFileAt(filePath: string): SpaceAccessFile | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    return parseAccessFile(raw);
  } catch {
    return null;
  }
}

function listAccessCandidatePaths(dataPath: string): string[] {
  const paths = [
    canonicalAccessFilePath(dataPath),
    hashedAccessFilePath(dataPath),
    legacyAccessFilePath(dataPath),
  ];
  const accessRoot = path.join(dataPath, 'co21', 'access');
  try {
    if (fs.existsSync(accessRoot)) {
      for (const entry of fs.readdirSync(accessRoot, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          paths.push(path.join(accessRoot, entry.name, ACCESS_FILE));
        } else if (entry.name.endsWith('.json')) {
          paths.push(path.join(accessRoot, entry.name));
        }
      }
    }
  } catch {
    void 0;
  }
  return [...new Set(paths)];
}

function findAccessFile(dataPath: string): { file: SpaceAccessFile; path: string } | null {
  for (const candidate of listAccessCandidatePaths(dataPath)) {
    const file = readAccessFileAt(candidate);
    if (file?.enabled && file.passwordHash) {
      return { file, path: candidate };
    }
  }
  return null;
}

function resolveAccessCredentials(
  dataPath: string,
): { passwordHash: string; source: 'space-access-file' | 'co21-profile' } | null {
  const fileAccess = findAccessFile(dataPath);
  if (fileAccess?.file.passwordHash) {
    return { passwordHash: fileAccess.file.passwordHash, source: 'space-access-file' };
  }
  const profileHash = readCo21ProfilePasswordHash(dataPath);
  if (profileHash) {
    return { passwordHash: profileHash, source: 'co21-profile' };
  }
  return null;
}

function writeAccessFile(dataPath: string, config: SpaceAccessFile): string {
  const filePath = canonicalAccessFilePath(dataPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf8');

  for (const stale of listAccessCandidatePaths(dataPath)) {
    if (stale === filePath) continue;
    try {
      if (fs.existsSync(stale)) fs.unlinkSync(stale);
    } catch {
      void 0;
    }
  }
  return filePath;
}

function deleteAccessFile(dataPath: string): void {
  for (const candidate of listAccessCandidatePaths(dataPath)) {
    try {
      if (fs.existsSync(candidate)) fs.unlinkSync(candidate);
    } catch {
      void 0;
    }
  }
}

export function getActiveSpaceAccessStatus(): SpaceAccessStatus {
  const snapshot = loadSpaceRegistrySnapshot();
  const active = snapshot.registry.spaces.find((s) => s.id === snapshot.registry.activeSpaceId);
  const spaceName = active?.name?.trim() || 'Space';
  const ctx = resolveActiveSpaceContext();
  const creds = resolveAccessCredentials(ctx.dataPath);

  if (process.env.NODE_ENV !== 'production') {
    console.error('[spaceAccess] status', {
      spaceId: snapshot.registry.activeSpaceId,
      dataPath: ctx.dataPath,
      source: creds?.source ?? null,
      protected: !!creds,
    });
  }

  if (!creds) {
    return { enabled: false, hasPassword: false, method: null, spaceName };
  }
  return {
    enabled: true,
    hasPassword: true,
    method: 'password',
    spaceName,
  };
}

export function verifyActiveSpacePassword(plain: string): boolean {
  const dataPath = resolveActiveDataPath();
  const creds = resolveAccessCredentials(dataPath);
  if (!creds) return true;
  if (!plain) return false;
  return hashPassword(plain) === creds.passwordHash;
}

export function setActiveSpaceAccessPassword(
  newPassword: string,
  currentPassword?: string,
): SpaceAccessStatus {
  const dataPath = resolveActiveDataPath();
  const existing = resolveAccessCredentials(dataPath);
  if (existing?.passwordHash) {
    const current = currentPassword ?? '';
    if (hashPassword(current) !== existing.passwordHash) {
      throw new Error('Current password is incorrect');
    }
  }
  const trimmed = newPassword.trim();
  if (!trimmed) throw new Error('Password is required');
  const written = writeAccessFile(dataPath, {
    enabled: true,
    method: 'password',
    passwordHash: hashPassword(trimmed),
    updatedAt: new Date().toISOString(),
  });
  if (process.env.NODE_ENV !== 'production') {
    console.error('[spaceAccess] password saved', { dataPath, written });
  }
  return getActiveSpaceAccessStatus();
}

export function disableActiveSpaceAccess(currentPassword: string): SpaceAccessStatus {
  const dataPath = resolveActiveDataPath();
  const existing = resolveAccessCredentials(dataPath);
  if (existing?.passwordHash) {
    if (!verifyActiveSpacePassword(currentPassword)) {
      throw new Error('Current password is incorrect');
    }
  }
  deleteAccessFile(dataPath);
  return getActiveSpaceAccessStatus();
}
