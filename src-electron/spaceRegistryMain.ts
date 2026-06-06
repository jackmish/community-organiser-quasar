import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import {
  SYSTEM_SPACE_ID,
  createDefaultSpaceRegistry,
  createSystemSpaceEntry,
  DEFAULT_SPACE_STORAGE_MODE,
  isSystemSpace,
  normalizeSpaceStorageMode,
  type SpaceEntry,
  type SpaceMigrateResult,
  type SpaceRegistry,
  type SpaceRegistrySnapshot,
  type SpaceStorageMode,
} from '../src/modules/space/models/SpaceModel';
import {
  migrateFilesToSqlite,
  sqliteDbExists,
  sqliteDbPathForDataRoot,
} from './spaceSqliteMain';

const REGISTRY_DIR = 'co21';
const REGISTRY_FILE = 'spaces-registry.json';

export function getDefaultUserDataPath(): string {
  return app.getPath('userData');
}

export function getGlobalRegistryFilePath(): string {
  return path.join(getDefaultUserDataPath(), REGISTRY_DIR, REGISTRY_FILE);
}

function normalizeRegistry(raw: unknown): SpaceRegistry {
  const fallback = createDefaultSpaceRegistry();
  if (!raw || typeof raw !== 'object') return fallback;
  const obj = raw as Partial<SpaceRegistry>;
  const spaces = Array.isArray(obj.spaces) ? obj.spaces.filter(isValidSpaceEntry) : [];
  const system = spaces.find((s) => isSystemSpace(s)) ?? createSystemSpaceEntry();
  const custom = spaces.filter((s) => !isSystemSpace(s));
  const merged: SpaceRegistry = {
    activeSpaceId:
      typeof obj.activeSpaceId === 'string' && obj.activeSpaceId.length
        ? obj.activeSpaceId
        : SYSTEM_SPACE_ID,
    spaces: [normalizeSpaceEntry(system), ...custom.map(normalizeSpaceEntry)],
  };
  if (!merged.spaces.some((s) => s.id === merged.activeSpaceId)) {
    merged.activeSpaceId = SYSTEM_SPACE_ID;
  }
  return merged;
}

function normalizeSpaceEntry(space: SpaceEntry): SpaceEntry {
  return {
    ...space,
    storageMode: normalizeSpaceStorageMode(space.storageMode),
    sqliteMigratedAt:
      typeof space.sqliteMigratedAt === 'string' ? space.sqliteMigratedAt : space.sqliteMigratedAt ?? null,
  };
}

function isValidSpaceEntry(value: unknown): value is SpaceEntry {
  if (!value || typeof value !== 'object') return false;
  const s = value as Partial<SpaceEntry>;
  if (typeof s.id !== 'string' || !s.id) return false;
  if (typeof s.name !== 'string' || !s.name.trim()) return false;
  if (s.type !== 'system' && s.type !== 'custom') return false;
  if (s.type === 'custom' && (typeof s.dataPath !== 'string' || !s.dataPath.trim())) return false;
  if (s.storageMode !== undefined && s.storageMode !== 'files' && s.storageMode !== 'sqlite') {
    return false;
  }
  return typeof s.createdAt === 'string';
}

function readRegistrySync(): SpaceRegistry {
  const filePath = getGlobalRegistryFilePath();
  try {
    if (!fs.existsSync(filePath)) {
      const reg = createDefaultSpaceRegistry();
      writeRegistrySync(reg);
      return reg;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    return normalizeRegistry(parsed);
  } catch {
    const reg = createDefaultSpaceRegistry();
    writeRegistrySync(reg);
    return reg;
  }
}

function writeRegistrySync(registry: SpaceRegistry): void {
  const filePath = getGlobalRegistryFilePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(registry, null, 2), 'utf8');
}

export function loadSpaceRegistrySnapshot(): SpaceRegistrySnapshot {
  const registry = readRegistrySync();
  const active = getSpaceById(registry.activeSpaceId, registry);
  return {
    registry,
    defaultUserDataPath: getDefaultUserDataPath(),
    activeDataPath: resolveActiveDataPath(registry),
    activeStorageMode: active?.storageMode ?? DEFAULT_SPACE_STORAGE_MODE,
  };
}

export function getSpaceById(spaceId: string, registry?: SpaceRegistry): SpaceEntry | null {
  const reg = registry ?? readRegistrySync();
  return reg.spaces.find((s) => s.id === spaceId) ?? null;
}

export function resolveDataPathForSpace(space: SpaceEntry): string {
  if (isSystemSpace(space)) return getDefaultUserDataPath();
  return space.dataPath?.trim() || getDefaultUserDataPath();
}

export function resolveActiveStorageMode(registry?: SpaceRegistry): SpaceStorageMode {
  const reg = registry ?? readRegistrySync();
  const active = reg.spaces.find((s) => s.id === reg.activeSpaceId);
  return active?.storageMode ?? DEFAULT_SPACE_STORAGE_MODE;
}

export function resolveActiveSpaceContext(): {
  dataPath: string;
  storageMode: SpaceStorageMode;
  dbPath: string;
  sqliteReady: boolean;
} {
  const registry = readRegistrySync();
  const dataPath = resolveActiveDataPath(registry);
  const storageMode = resolveActiveStorageMode(registry);
  const dbPath = sqliteDbPathForDataRoot(dataPath);
  return {
    dataPath,
    storageMode,
    dbPath,
    sqliteReady: storageMode === 'sqlite' && sqliteDbExists(dataPath),
  };
}

export function resolveActiveDataPath(registry?: SpaceRegistry): string {
  const reg = registry ?? readRegistrySync();
  const active = reg.spaces.find((s) => s.id === reg.activeSpaceId);
  if (!active || isSystemSpace(active)) return getDefaultUserDataPath();
  const customPath = active.dataPath?.trim();
  return customPath || getDefaultUserDataPath();
}

export function createCustomSpace(name: string, dataPath: string): SpaceEntry {
  const trimmedName = name.trim();
  const trimmedPath = path.resolve(dataPath.trim());
  if (!trimmedName) throw new Error('Space name is required');
  if (!trimmedPath) throw new Error('Space folder is required');

  const registry = readRegistrySync();
  const duplicate = registry.spaces.some(
    (s) => s.type === 'custom' && s.dataPath && path.resolve(s.dataPath) === trimmedPath,
  );
  if (duplicate) throw new Error('A space with this folder already exists');

  fs.mkdirSync(trimmedPath, { recursive: true });

  const entry: SpaceEntry = {
    id: randomUUID(),
    name: trimmedName,
    type: 'custom',
    dataPath: trimmedPath,
    storageMode: DEFAULT_SPACE_STORAGE_MODE,
    sqliteMigratedAt: null,
    createdAt: new Date().toISOString(),
  };
  registry.spaces.push(entry);
  writeRegistrySync(registry);
  return entry;
}

export function setActiveSpaceId(spaceId: string): SpaceRegistry {
  const registry = readRegistrySync();
  if (!registry.spaces.some((s) => s.id === spaceId)) {
    throw new Error('Unknown space');
  }
  registry.activeSpaceId = spaceId;
  writeRegistrySync(registry);
  return registry;
}

export function setSpaceStorageMode(spaceId: string, mode: SpaceStorageMode): SpaceEntry {
  const registry = readRegistrySync();
  const space = getSpaceById(spaceId, registry);
  if (!space) throw new Error('Unknown space');
  const dataPath = resolveDataPathForSpace(space);
  if (mode === 'sqlite' && !sqliteDbExists(dataPath)) {
    throw new Error('SQLite database not found — migrate first');
  }
  space.storageMode = mode;
  writeRegistrySync(registry);
  return space;
}

export function migrateSpaceStorageToSqlite(spaceId: string): {
  space: SpaceEntry;
  result: SpaceMigrateResult;
} {
  const registry = readRegistrySync();
  const space = getSpaceById(spaceId, registry);
  if (!space) throw new Error('Unknown space');
  const dataPath = resolveDataPathForSpace(space);
  const result = migrateFilesToSqlite(dataPath);
  space.storageMode = 'sqlite';
  space.sqliteMigratedAt = new Date().toISOString();
  writeRegistrySync(registry);
  return { space, result };
}
