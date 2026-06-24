import fs from 'fs';
import path from 'path';
import os from 'os';
import { createHash } from 'node:crypto';
import type { SpaceAccessFile, SpaceAccessStatus } from '../src/modules/space/spaceAccessModel';
import {
  APP_DATA_PATH_SEGMENTS,
  LEGACY_CO21_DIR,
} from '../src/modules/storage/appDataPaths';
import {
  loadSpaceRegistrySnapshot,
  resolveActiveDataPath,
  resolveActiveSpaceContext,
  resolveDataPathForSpace,
} from './spaceRegistryMain';
import { getCo21ProfileRoot } from './electronProfilePaths';

const ACCESS_FILE = 'space-access.json';
const DEVICE_ACCESS_FILE = 'device-space-access.json';
const LEGACY_ACCESS_FILE = path.join(LEGACY_CO21_DIR, ACCESS_FILE);

function hashPassword(plain: string): string {
  return createHash('sha256').update(plain, 'utf8').digest('hex');
}

function resolveLocalDeviceKey(): string {
  const seed = `${os.hostname()}|${getCo21ProfileRoot()}`;
  return createHash('sha256').update(seed, 'utf8').digest('hex').slice(0, 16);
}

function canonicalAccessFilePath(dataPath: string): string {
  return path.join(dataPath, ...APP_DATA_PATH_SEGMENTS.co21Access, DEVICE_ACCESS_FILE);
}

function hashedAccessFilePath(dataPath: string): string {
  return path.join(
    dataPath,
    ...APP_DATA_PATH_SEGMENTS.co21Access,
    resolveLocalDeviceKey(),
    ACCESS_FILE,
  );
}

function legacyAccessFilePath(dataPath: string): string {
  return path.join(dataPath, LEGACY_ACCESS_FILE);
}

function parseAccessFile(raw: string): SpaceAccessFile | null {
  try {
    if (!raw.trim()) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const obj = parsed as Partial<SpaceAccessFile>;
    const passwordHash = typeof obj.passwordHash === 'string' ? obj.passwordHash : null;
    const enabled =
      typeof obj.enabled === 'boolean' ? obj.enabled : !!passwordHash;
    return {
      enabled,
      method: 'password',
      passwordHash,
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

function listAccessRoots(dataPath: string): string[] {
  return [
    path.join(dataPath, ...APP_DATA_PATH_SEGMENTS.co21Access),
    path.join(dataPath, ...APP_DATA_PATH_SEGMENTS.legacyCo21Access),
  ];
}

function listAccessCandidatePaths(dataPath: string): string[] {
  const paths = [
    canonicalAccessFilePath(dataPath),
    hashedAccessFilePath(dataPath),
    legacyAccessFilePath(dataPath),
  ];
  for (const accessRoot of listAccessRoots(dataPath)) {
    try {
      if (!fs.existsSync(accessRoot)) continue;
      for (const entry of fs.readdirSync(accessRoot, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          paths.push(path.join(accessRoot, entry.name, ACCESS_FILE));
        } else if (entry.name.endsWith('.json')) {
          paths.push(path.join(accessRoot, entry.name));
        }
      }
    } catch {
      void 0;
    }
  }
  return [...new Set(paths)];
}

/** Simple local password auth only — not CO21 account or future auth methods. */
function readSimpleAccessRecord(dataPath: string): { file: SpaceAccessFile; path: string } | null {
  for (const candidate of listAccessCandidatePaths(dataPath)) {
    const file = readAccessFileAt(candidate);
    if (!file) continue;
    if (file.passwordHash || file.enabled) {
      return { file, path: candidate };
    }
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

function statusFromDataPath(dataPath: string, spaceName: string): SpaceAccessStatus {
  const record = readSimpleAccessRecord(dataPath);
  const hasPassword = !!record?.file.passwordHash;
  const enabled = !!record?.file.enabled && hasPassword;
  return {
    enabled,
    hasPassword,
    method: hasPassword ? 'password' : null,
    spaceName,
  };
}

export function getActiveSpaceAccessStatus(): SpaceAccessStatus {
  const snapshot = loadSpaceRegistrySnapshot();
  const active = snapshot.registry.spaces.find((s) => s.id === snapshot.registry.activeSpaceId);
  const spaceName = active?.name?.trim() || 'Space';
  const ctx = resolveActiveSpaceContext();
  return statusFromDataPath(ctx.dataPath, spaceName);
}

export function getSpaceAccessStatusById(spaceId: string): SpaceAccessStatus {
  const snapshot = loadSpaceRegistrySnapshot();
  const space = snapshot.registry.spaces.find((s) => s.id === spaceId);
  if (!space) {
    return { enabled: false, hasPassword: false, method: null, spaceName: '' };
  }
  const spaceName = space.name?.trim() || 'Space';
  return statusFromDataPath(resolveDataPathForSpace(space), spaceName);
}

export function getAllSpacesAccessStatus(): Record<string, SpaceAccessStatus> {
  const snapshot = loadSpaceRegistrySnapshot();
  const result: Record<string, SpaceAccessStatus> = {};
  for (const space of snapshot.registry.spaces) {
    const spaceName = space.name?.trim() || 'Space';
    result[space.id] = statusFromDataPath(resolveDataPathForSpace(space), spaceName);
  }
  return result;
}

export function verifyActiveSpacePassword(plain: string): boolean {
  const dataPath = resolveActiveDataPath();
  const record = readSimpleAccessRecord(dataPath);
  if (!record?.file.passwordHash) return false;
  return record.file.passwordHash === hashPassword(plain);
}

function activeSpaceName(): string {
  const snapshot = loadSpaceRegistrySnapshot();
  const active = snapshot.registry.spaces.find((s) => s.id === snapshot.registry.activeSpaceId);
  return active?.name?.trim() || 'Space';
}

export function setActiveSpaceAccessPassword(
  password: string,
  currentPassword?: string,
): SpaceAccessStatus {
  const dataPath = resolveActiveDataPath();
  const spaceName = activeSpaceName();
  const existing = readSimpleAccessRecord(dataPath);
  if (existing?.file.passwordHash) {
    const current = currentPassword ?? '';
    if (existing.file.passwordHash !== hashPassword(current)) {
      throw new Error('Current password is incorrect');
    }
  }
  const now = new Date().toISOString();
  writeAccessFile(dataPath, {
    enabled: true,
    method: 'password',
    passwordHash: hashPassword(password),
    updatedAt: now,
  });
  return statusFromDataPath(dataPath, spaceName);
}

export function setSimpleSpaceAccessEnabled(enabled: boolean): SpaceAccessStatus {
  const dataPath = resolveActiveDataPath();
  const spaceName = activeSpaceName();
  const existing = readSimpleAccessRecord(dataPath);
  if (!existing?.file.passwordHash) {
    return statusFromDataPath(dataPath, spaceName);
  }
  writeAccessFile(dataPath, {
    ...existing.file,
    enabled,
    updatedAt: new Date().toISOString(),
  });
  return statusFromDataPath(dataPath, spaceName);
}

export function disableActiveSpaceAccess(): SpaceAccessStatus {
  return setSimpleSpaceAccessEnabled(false);
}
