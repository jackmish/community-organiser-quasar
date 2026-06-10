import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import {
  CO21_SQLITE_DB_FILENAME,
  SYSTEM_SPACE_ID,
  createDefaultSpaceRegistry,
  createSystemSpaceEntry,
  DEFAULT_SPACE_STORAGE_MODE,
  isSystemSpace,
  normalizeSpaceStorageMode,
  type SpaceEntry,
  type SpaceMigrateResult,
  type SpacePathIssue,
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
    defaultSpaceId:
      typeof obj.defaultSpaceId === 'string' && obj.defaultSpaceId.length
        ? obj.defaultSpaceId
        : null,
    spaces: [normalizeSpaceEntry(system), ...custom.map(normalizeSpaceEntry)],
  };
  if (!merged.spaces.some((s) => s.id === merged.activeSpaceId)) {
    merged.activeSpaceId = SYSTEM_SPACE_ID;
  }
  if (
    merged.defaultSpaceId &&
    !merged.spaces.some((s) => s.id === merged.defaultSpaceId)
  ) {
    merged.defaultSpaceId = null;
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

function dirHasGroupJsonFiles(dirPath: string): boolean {
  try {
    if (!fs.existsSync(dirPath)) return false;
    const files = fs.readdirSync(dirPath);
    return files.some((f) => /^group-.+\.json$/i.test(f));
  } catch {
    return false;
  }
}

/** True when folder looks like an existing CO21 workspace (groups, settings, or SQLite). */
export function looksLikeCo21Workspace(dataPath: string): boolean {
  const root = path.resolve(String(dataPath || '').trim());
  if (!root || !fs.existsSync(root)) return false;
  if (fs.existsSync(path.join(root, CO21_SQLITE_DB_FILENAME))) return true;
  if (dirHasGroupJsonFiles(path.join(root, 'storage', 'group'))) return true;
  if (fs.existsSync(path.join(root, 'co21', 'settings.json'))) return true;
  if (fs.existsSync(path.join(root, 'storage', 'settings.json'))) return true;
  return false;
}

function detectSpacePathIssues(registry: SpaceRegistry): SpacePathIssue[] {
  const issues: SpacePathIssue[] = [];
  for (const space of registry.spaces) {
    if (isSystemSpace(space)) continue;
    const expectedPath = space.dataPath?.trim();
    if (!expectedPath) continue;
    const resolved = path.resolve(expectedPath);
    if (!fs.existsSync(resolved)) {
      issues.push({
        spaceId: space.id,
        name: space.name,
        expectedPath: resolved,
        kind: 'missing',
      });
      continue;
    }
    const mode = normalizeSpaceStorageMode(space.storageMode);
    if (mode === 'sqlite' && !sqliteDbExists(resolved)) {
      issues.push({
        spaceId: space.id,
        name: space.name,
        expectedPath: resolved,
        kind: 'no_data',
      });
      continue;
    }
    if (!looksLikeCo21Workspace(resolved)) {
      issues.push({
        spaceId: space.id,
        name: space.name,
        expectedPath: resolved,
        kind: 'no_data',
      });
    }
  }
  return issues;
}

function spaceHasPathIssue(spaceId: string, registry: SpaceRegistry): boolean {
  return detectSpacePathIssues(registry).some((i) => i.spaceId === spaceId);
}

function pickFallbackActiveSpaceId(registry: SpaceRegistry): string {
  const issues = new Set(detectSpacePathIssues(registry).map((i) => i.spaceId));
  const system = registry.spaces.find((s) => s.id === SYSTEM_SPACE_ID);
  if (system && !issues.has(system.id)) return system.id;
  const ok = registry.spaces.find((s) => !issues.has(s.id));
  return ok?.id ?? SYSTEM_SPACE_ID;
}

function detectActiveSpacePathIssue(registry: SpaceRegistry): SpacePathIssue | null {
  const issues = detectSpacePathIssues(registry);
  return issues.find((i) => i.spaceId === registry.activeSpaceId) ?? null;
}

export function loadSpaceRegistrySnapshot(): SpaceRegistrySnapshot {
  const registry = readRegistrySync();
  const active = getSpaceById(registry.activeSpaceId, registry);
  const spacePathIssues = detectSpacePathIssues(registry);
  return {
    registry,
    defaultUserDataPath: getDefaultUserDataPath(),
    activeDataPath: resolveActiveDataPath(registry),
    activeStorageMode: active?.storageMode ?? DEFAULT_SPACE_STORAGE_MODE,
    defaultSpaceId: registry.defaultSpaceId ?? null,
    activeSpacePathMissing: detectActiveSpacePathIssue(registry),
    spacePathIssues,
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

/** On a fresh app launch: open default space when set and healthy, otherwise keep last accessed. */
export function applyColdBootSpaceSelection(): void {
  const registry = readRegistrySync();
  const defaultId = registry.defaultSpaceId;
  if (!defaultId || !registry.spaces.some((s) => s.id === defaultId)) return;
  if (spaceHasPathIssue(defaultId, registry)) return;
  if (registry.activeSpaceId === defaultId) return;
  registry.activeSpaceId = defaultId;
  writeRegistrySync(registry);
}

/** Switch away from a broken workspace without locating its folder. */
export function skipBrokenActiveSpace(): SpaceRegistry {
  const registry = readRegistrySync();
  if (!spaceHasPathIssue(registry.activeSpaceId, registry)) return registry;
  const brokenId = registry.activeSpaceId;
  if (registry.defaultSpaceId === brokenId) {
    registry.defaultSpaceId = null;
  }
  registry.activeSpaceId = pickFallbackActiveSpaceId(registry);
  writeRegistrySync(registry);
  return registry;
}

/** Open another workspace and stop prompting for a broken one (clears broken default). */
export function switchAwayFromBrokenWorkspace(
  targetSpaceId: string,
  brokenSpaceId: string,
): SpaceRegistry {
  const registry = readRegistrySync();
  if (!registry.spaces.some((s) => s.id === targetSpaceId)) {
    throw new Error('Unknown space');
  }
  if (spaceHasPathIssue(targetSpaceId, registry)) {
    throw new Error('Cannot switch to an unavailable workspace');
  }
  if (registry.defaultSpaceId === brokenSpaceId) {
    registry.defaultSpaceId = null;
  }
  registry.activeSpaceId = targetSpaceId;
  writeRegistrySync(registry);
  return registry;
}

/** Delete the entire custom workspace folder from disk (project path only). */
export function deleteProjectFolderOnDisk(dataPath: string): void {
  const root = path.resolve(String(dataPath || '').trim());
  if (!root || !fs.existsSync(root)) return;

  const userData = path.resolve(getDefaultUserDataPath());
  if (root === userData) {
    throw new Error('Cannot delete the application data folder');
  }
  const parsed = path.parse(root);
  if (!parsed.root || root === parsed.root) {
    throw new Error('Cannot delete a drive root folder');
  }

  fs.rmSync(root, { recursive: true, force: true });
}

/** Remove a custom workspace from the registry; optionally delete its folder on disk. */
export function removeCustomSpaceFromRegistry(
  spaceId: string,
  options: { deleteProjectFolder?: boolean } = {},
): SpaceRegistry {
  const registry = readRegistrySync();
  const space = getSpaceById(spaceId, registry);
  if (!space || isSystemSpace(space)) {
    throw new Error('Cannot remove this workspace');
  }

  const dataPath = space.dataPath?.trim();
  if (options.deleteProjectFolder && dataPath) {
    deleteProjectFolderOnDisk(dataPath);
  }

  registry.spaces = registry.spaces.filter((s) => s.id !== spaceId);

  if (registry.activeSpaceId === spaceId) {
    registry.activeSpaceId = pickFallbackActiveSpaceId(registry);
  }
  if (registry.defaultSpaceId === spaceId) {
    registry.defaultSpaceId = null;
  }

  writeRegistrySync(registry);
  return registry;
}

export function setDefaultSpaceId(spaceId: string | null): SpaceRegistry {
  const registry = readRegistrySync();
  const trimmed = spaceId?.trim() || null;
  if (trimmed && !registry.spaces.some((s) => s.id === trimmed)) {
    throw new Error('Unknown space');
  }
  registry.defaultSpaceId = trimmed;
  writeRegistrySync(registry);
  return registry;
}

export function createCustomSpace(name: string, dataPath: string): SpaceEntry {
  const trimmedName = name.trim();
  const trimmedPath = path.resolve(dataPath.trim());
  if (!trimmedName) throw new Error('Space name is required');
  if (!trimmedPath) throw new Error('Space folder is required');

  const registry = readRegistrySync();
  assertUniqueCustomSpacePath(registry, trimmedPath);

  fs.mkdirSync(trimmedPath, { recursive: true });

  const entry = buildCustomSpaceEntry(trimmedName, trimmedPath);
  registry.spaces.push(entry);
  writeRegistrySync(registry);
  return entry;
}

/** Link an existing folder as a workspace (does not create the folder). */
export function registerExistingSpace(name: string, dataPath: string): SpaceEntry {
  const trimmedName = name.trim();
  const trimmedPath = path.resolve(dataPath.trim());
  if (!trimmedName) throw new Error('Space name is required');
  if (!trimmedPath) throw new Error('Space folder is required');
  if (!fs.existsSync(trimmedPath)) throw new Error('Folder does not exist');
  if (!looksLikeCo21Workspace(trimmedPath)) {
    throw new Error('Folder does not look like a CO21 workspace');
  }

  const registry = readRegistrySync();
  assertUniqueCustomSpacePath(registry, trimmedPath);

  const entry = buildCustomSpaceEntry(trimmedName, trimmedPath);
  if (sqliteDbExists(trimmedPath)) {
    entry.storageMode = 'sqlite';
    entry.sqliteMigratedAt = entry.createdAt;
  }
  registry.spaces.push(entry);
  writeRegistrySync(registry);
  return entry;
}

/** Update folder path when the workspace was moved on disk. */
export function relocateCustomSpacePath(spaceId: string, newDataPath: string): SpaceEntry {
  const trimmedPath = path.resolve(newDataPath.trim());
  if (!trimmedPath) throw new Error('Space folder is required');
  if (!fs.existsSync(trimmedPath)) throw new Error('Folder does not exist');
  if (!looksLikeCo21Workspace(trimmedPath)) {
    throw new Error('Folder does not look like a CO21 workspace');
  }

  const registry = readRegistrySync();
  const space = getSpaceById(spaceId, registry);
  if (!space || isSystemSpace(space)) throw new Error('Unknown space');

  const duplicate = registry.spaces.some(
    (s) =>
      s.id !== spaceId &&
      s.type === 'custom' &&
      s.dataPath &&
      path.resolve(s.dataPath) === trimmedPath,
  );
  if (duplicate) throw new Error('A space with this folder already exists');

  space.dataPath = trimmedPath;
  if (sqliteDbExists(trimmedPath)) {
    space.storageMode = 'sqlite';
    space.sqliteMigratedAt = space.sqliteMigratedAt ?? new Date().toISOString();
  }
  writeRegistrySync(registry);
  return space;
}

/** Copy workspace to a new folder, update registry, then remove the old folder. */
export function moveCustomSpaceFolder(spaceId: string, newDataPath: string): SpaceEntry {
  const trimmedPath = path.resolve(newDataPath.trim());
  if (!trimmedPath) throw new Error('Space folder is required');

  const registry = readRegistrySync();
  const space = getSpaceById(spaceId, registry);
  if (!space || isSystemSpace(space)) throw new Error('Unknown space');
  const oldPath = path.resolve(space.dataPath?.trim() || '');
  if (!oldPath || !fs.existsSync(oldPath)) {
    throw new Error('Source workspace folder does not exist — use Locate instead');
  }
  if (!looksLikeCo21Workspace(oldPath)) {
    throw new Error('Source folder does not look like a CO21 workspace');
  }
  if (trimmedPath === oldPath) throw new Error('Choose a different folder');

  const duplicate = registry.spaces.some(
    (s) =>
      s.id !== spaceId &&
      s.type === 'custom' &&
      s.dataPath &&
      path.resolve(s.dataPath) === trimmedPath,
  );
  if (duplicate) throw new Error('A space with this folder already exists');

  if (fs.existsSync(trimmedPath)) {
    const entries = fs.readdirSync(trimmedPath);
    if (entries.length > 0) throw new Error('Destination folder must be empty');
  } else {
    fs.mkdirSync(trimmedPath, { recursive: true });
  }

  fs.cpSync(oldPath, trimmedPath, { recursive: true, force: false });
  space.dataPath = trimmedPath;
  if (sqliteDbExists(trimmedPath)) {
    space.storageMode = 'sqlite';
    space.sqliteMigratedAt = space.sqliteMigratedAt ?? new Date().toISOString();
  }
  writeRegistrySync(registry);
  fs.rmSync(oldPath, { recursive: true, force: true });
  return space;
}

function assertUniqueCustomSpacePath(registry: SpaceRegistry, trimmedPath: string): void {
  const duplicate = registry.spaces.some(
    (s) => s.type === 'custom' && s.dataPath && path.resolve(s.dataPath) === trimmedPath,
  );
  if (duplicate) throw new Error('A space with this folder already exists');
}

function buildCustomSpaceEntry(trimmedName: string, trimmedPath: string): SpaceEntry {
  return {
    id: randomUUID(),
    name: trimmedName,
    type: 'custom',
    dataPath: trimmedPath,
    storageMode: DEFAULT_SPACE_STORAGE_MODE,
    sqliteMigratedAt: null,
    createdAt: new Date().toISOString(),
  };
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
