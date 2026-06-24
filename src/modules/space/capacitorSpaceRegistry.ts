import {
  createDefaultSpaceRegistry,
  createSystemSpaceEntry,
  DEFAULT_NEW_WORKSPACE_STORAGE_MODE,
  DEFAULT_SPACE_STORAGE_MODE,
  isSystemSpace,
  normalizeSpaceStorageMode,
  SYSTEM_SPACE_ID,
  type SpaceEntry,
  type SpaceMigrateResult,
  type SpacePathIssue,
  type SpaceRegistry,
  type SpaceRegistrySnapshot,
  type SpaceStorageMode,
} from './models/SpaceModel';
import {
  CAPACITOR_REGISTRY_PATH,
  CAPACITOR_SPACES_DIR,
  capacitorSqliteRelativePath,
  capacitorWorkspaceRootForSpace,
  getCapacitorDefaultDataRootLabel,
  joinCapacitorWorkspacePath,
  resolveCapacitorActiveWorkspaceRoot,
  resolveCapacitorDataPathForSpace,
} from './capacitorSpacePaths';
import {
  ensureCapacitorDataDir,
  listCapacitorDirNames,
  readCapacitorJsonFile,
  writeCapacitorJsonFile,
  capacitorPathExists,
} from 'src/modules/storage/backend/mobile/capacitorAppDataFiles';
import {
  isGroupJsonFilename,
} from 'src/modules/storage/backend/electron/groupFileLoader';
import { APP_DATA_PATH_SEGMENTS } from 'src/modules/storage/appDataPaths';
import logger from 'src/utils/logger';

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `space-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
  if (merged.defaultSpaceId && !merged.spaces.some((s) => s.id === merged.defaultSpaceId)) {
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

async function readRegistry(): Promise<SpaceRegistry> {
  try {
    const parsed = await readCapacitorJsonFile(CAPACITOR_REGISTRY_PATH);
    if (!parsed) {
      const reg = createDefaultSpaceRegistry();
      await writeRegistry(reg);
      return reg;
    }
    return normalizeRegistry(parsed);
  } catch (err) {
    logger.warn('[capacitorSpaceRegistry] read failed, resetting', err);
    const reg = createDefaultSpaceRegistry();
    await writeRegistry(reg);
    return reg;
  }
}

async function writeRegistry(registry: SpaceRegistry): Promise<void> {
  await ensureCapacitorDataDir(APP_DATA_PATH_SEGMENTS.co21Config.join('/'));
  await writeCapacitorJsonFile(CAPACITOR_REGISTRY_PATH, registry);
}

async function dirHasGroupJsonFiles(relativeDir: string): Promise<boolean> {
  const files = await listCapacitorDirNames(relativeDir);
  return files.some((f) => isGroupJsonFilename(f));
}

async function looksLikeCo21Workspace(workspaceRoot: string): Promise<boolean> {
  const groupDir = joinCapacitorWorkspacePath(workspaceRoot, ...APP_DATA_PATH_SEGMENTS.group);
  if (await dirHasGroupJsonFiles(groupDir)) return true;

  const { capacitorSqliteDbExistsForWorkspace } = await import(
    'src/modules/storage/backend/mobile/capacitorSqliteService'
  );
  if (await capacitorSqliteDbExistsForWorkspace(workspaceRoot)) return true;

  const settingsPath = joinCapacitorWorkspacePath(
    workspaceRoot,
    ...APP_DATA_PATH_SEGMENTS.organiserSettingsFile,
  );
  const settings = await readCapacitorJsonFile(settingsPath);
  if (settings && typeof settings === 'object') return true;

  const co21Path = joinCapacitorWorkspacePath(
    workspaceRoot,
    ...APP_DATA_PATH_SEGMENTS.co21SettingsFile,
  );
  const co21 = await readCapacitorJsonFile(co21Path);
  return !!(co21 && typeof co21 === 'object');
}

async function detectSpacePathIssues(registry: SpaceRegistry): Promise<SpacePathIssue[]> {
  const issues: SpacePathIssue[] = [];
  for (const space of registry.spaces) {
    if (isSystemSpace(space)) continue;
    const expectedPath = space.dataPath?.trim();
    if (!expectedPath) continue;

    if (!(await capacitorPathExists(expectedPath))) {
      issues.push({
        spaceId: space.id,
        name: space.name,
        expectedPath,
        kind: 'missing',
      });
      continue;
    }

    const mode = normalizeSpaceStorageMode(space.storageMode);
    if (mode === 'sqlite') {
      const { capacitorSqliteDbExistsForWorkspace } = await import(
        'src/modules/storage/backend/mobile/capacitorSqliteService'
      );
      if (!(await capacitorSqliteDbExistsForWorkspace(expectedPath))) {
        issues.push({
          spaceId: space.id,
          name: space.name,
          expectedPath,
          kind: 'no_data',
        });
      }
    } else if (!(await looksLikeCo21Workspace(expectedPath))) {
      issues.push({
        spaceId: space.id,
        name: space.name,
        expectedPath,
        kind: 'no_data',
      });
    }
  }
  return issues;
}

function pickFallbackActiveSpaceId(registry: SpaceRegistry, issues: SpacePathIssue[]): string {
  const blocked = new Set(issues.map((i) => i.spaceId));
  const system = registry.spaces.find((s) => s.id === SYSTEM_SPACE_ID);
  if (system && !blocked.has(system.id)) return system.id;
  const ok = registry.spaces.find((s) => !blocked.has(s.id));
  return ok?.id ?? SYSTEM_SPACE_ID;
}

export async function loadCapacitorSpaceRegistrySnapshot(): Promise<SpaceRegistrySnapshot> {
  const registry = await readRegistry();
  const active = registry.spaces.find((s) => s.id === registry.activeSpaceId);
  const spacePathIssues = await detectSpacePathIssues(registry);
  return {
    registry,
    defaultUserDataPath: getCapacitorDefaultDataRootLabel(),
    activeDataPath: resolveCapacitorActiveWorkspaceRoot(registry) || getCapacitorDefaultDataRootLabel(),
    activeStorageMode: active?.storageMode ?? DEFAULT_SPACE_STORAGE_MODE,
    defaultSpaceId: registry.defaultSpaceId ?? null,
    activeSpacePathMissing:
      spacePathIssues.find((i) => i.spaceId === registry.activeSpaceId) ?? null,
    spacePathIssues,
  };
}

async function bootstrapSqliteForWorkspace(workspaceRoot: string): Promise<void> {
  const { setCapacitorSqliteWorkspaceRoot, openCapacitorSqliteDb } = await import(
    'src/modules/storage/backend/mobile/capacitorSqliteService'
  );
  const { ensureCapacitorSqliteMigratedForWorkspace } = await import(
    'src/modules/storage/backend/mobile/capacitorSqliteMigration'
  );
  await setCapacitorSqliteWorkspaceRoot(workspaceRoot);
  await openCapacitorSqliteDb();
  await ensureCapacitorSqliteMigratedForWorkspace(workspaceRoot);
}

export async function createCapacitorCustomSpace(name: string): Promise<SpaceEntry> {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error('Space name is required');

  const registry = await readRegistry();
  const id = randomId();
  const relativePath = `${CAPACITOR_SPACES_DIR}/${id}`;

  await ensureCapacitorDataDir(relativePath);
  await ensureCapacitorDataDir(
    joinCapacitorWorkspacePath(relativePath, ...APP_DATA_PATH_SEGMENTS.workspace),
  );

  const entry: SpaceEntry = {
    id,
    name: trimmedName,
    type: 'custom',
    dataPath: relativePath,
    storageMode: DEFAULT_NEW_WORKSPACE_STORAGE_MODE,
    sqliteMigratedAt: null,
    createdAt: new Date().toISOString(),
  };

  if (entry.storageMode === 'sqlite') {
    await bootstrapSqliteForWorkspace(relativePath);
    entry.sqliteMigratedAt = entry.createdAt;
  }

  registry.spaces.push(entry);
  await writeRegistry(registry);
  return entry;
}

export async function switchCapacitorSpace(spaceId: string): Promise<void> {
  const registry = await readRegistry();
  if (!registry.spaces.some((s) => s.id === spaceId)) {
    throw new Error('Unknown space');
  }
  const issues = await detectSpacePathIssues(registry);
  if (issues.some((i) => i.spaceId === spaceId)) {
    throw new Error('Cannot switch to an unavailable workspace');
  }
  registry.activeSpaceId = spaceId;
  await writeRegistry(registry);

  const active = registry.spaces.find((s) => s.id === spaceId);
  const workspaceRoot = active ? capacitorWorkspaceRootForSpace(active) : '';
  const { setCapacitorSqliteWorkspaceRoot } = await import(
    'src/modules/storage/backend/mobile/capacitorSqliteService'
  );
  await setCapacitorSqliteWorkspaceRoot(workspaceRoot);
}

export async function switchCapacitorSpaceAndReload(spaceId: string): Promise<void> {
  await switchCapacitorSpace(spaceId);
  window.location.reload();
}

export async function removeCapacitorWorkspace(
  spaceId: string,
  options: { deleteProjectFolder?: boolean } = {},
): Promise<void> {
  const registry = await readRegistry();
  const space = registry.spaces.find((s) => s.id === spaceId);
  if (!space || isSystemSpace(space)) {
    throw new Error('Cannot remove this workspace');
  }

  if (options.deleteProjectFolder && space.dataPath?.trim()) {
    const { deleteCapacitorWorkspaceTree } = await import('./capacitorSpaceStorage');
    await deleteCapacitorWorkspaceTree(space.dataPath.trim());
  }

  registry.spaces = registry.spaces.filter((s) => s.id !== spaceId);
  const issues = await detectSpacePathIssues(registry);
  if (registry.activeSpaceId === spaceId) {
    registry.activeSpaceId = pickFallbackActiveSpaceId(registry, issues);
  }
  if (registry.defaultSpaceId === spaceId) {
    registry.defaultSpaceId = null;
  }
  await writeRegistry(registry);
}

export async function setCapacitorDefaultSpace(spaceId: string | null): Promise<string | null> {
  const registry = await readRegistry();
  const trimmed = spaceId?.trim() || null;
  if (trimmed && !registry.spaces.some((s) => s.id === trimmed)) {
    throw new Error('Unknown space');
  }
  registry.defaultSpaceId = trimmed;
  await writeRegistry(registry);
  return registry.defaultSpaceId ?? null;
}

export async function skipCapacitorBrokenActiveWorkspace(): Promise<void> {
  const registry = await readRegistry();
  const issues = await detectSpacePathIssues(registry);
  if (!issues.some((i) => i.spaceId === registry.activeSpaceId)) return;
  const brokenId = registry.activeSpaceId;
  if (registry.defaultSpaceId === brokenId) {
    registry.defaultSpaceId = null;
  }
  registry.activeSpaceId = pickFallbackActiveSpaceId(registry, issues);
  await writeRegistry(registry);
}

export async function switchCapacitorAwayFromBrokenWorkspace(
  targetSpaceId: string,
  brokenSpaceId: string,
): Promise<void> {
  const registry = await readRegistry();
  const issues = await detectSpacePathIssues(registry);
  if (!registry.spaces.some((s) => s.id === targetSpaceId)) {
    throw new Error('Unknown space');
  }
  if (issues.some((i) => i.spaceId === targetSpaceId)) {
    throw new Error('Cannot switch to an unavailable workspace');
  }
  if (registry.defaultSpaceId === brokenSpaceId) {
    registry.defaultSpaceId = null;
  }
  registry.activeSpaceId = targetSpaceId;
  await writeRegistry(registry);
  await switchCapacitorSpaceAndReload(targetSpaceId);
}

export async function setCapacitorSpaceStorageMode(
  spaceId: string,
  mode: SpaceStorageMode,
): Promise<SpaceEntry> {
  const registry = await readRegistry();
  const space = registry.spaces.find((s) => s.id === spaceId);
  if (!space) throw new Error('Unknown space');
  const workspaceRoot = resolveCapacitorDataPathForSpace(space);
  if (mode === 'sqlite') {
    const { capacitorSqliteDbExistsForWorkspace } = await import(
      'src/modules/storage/backend/mobile/capacitorSqliteService'
    );
    if (!(await capacitorSqliteDbExistsForWorkspace(workspaceRoot))) {
      throw new Error('SQLite database not found — migrate first');
    }
  }
  space.storageMode = mode;
  await writeRegistry(registry);
  return space;
}

export async function migrateCapacitorSpaceToSqlite(
  spaceId: string,
): Promise<{ space: SpaceEntry; result: SpaceMigrateResult }> {
  const registry = await readRegistry();
  const space = registry.spaces.find((s) => s.id === spaceId);
  if (!space) throw new Error('Unknown space');
  const workspaceRoot = resolveCapacitorDataPathForSpace(space);
  const { setCapacitorSqliteWorkspaceRoot } = await import(
    'src/modules/storage/backend/mobile/capacitorSqliteService'
  );
  await setCapacitorSqliteWorkspaceRoot(workspaceRoot);
  const { ensureCapacitorSqliteMigratedForWorkspace } = await import(
    'src/modules/storage/backend/mobile/capacitorSqliteMigration'
  );
  await ensureCapacitorSqliteMigratedForWorkspace(workspaceRoot, { force: true });
  const result: SpaceMigrateResult = {
    groupCount: 0,
    settingsKeyCount: 0,
    co21SettingsImported: true,
    dbPath: capacitorSqliteRelativePath(workspaceRoot),
  };
  space.storageMode = 'sqlite';
  space.sqliteMigratedAt = new Date().toISOString();
  await writeRegistry(registry);
  return { space, result };
}

export async function reloadCapacitorAppForSpaceChanges(): Promise<void> {
  window.location.reload();
}

export async function getActiveCapacitorWorkspaceRoot(): Promise<string> {
  const registry = await readRegistry();
  return resolveCapacitorActiveWorkspaceRoot(registry);
}

export async function ensureCapacitorActiveWorkspaceBound(): Promise<void> {
  const root = await getActiveCapacitorWorkspaceRoot();
  const { setCapacitorSqliteWorkspaceRoot } = await import(
    'src/modules/storage/backend/mobile/capacitorSqliteService'
  );
  await setCapacitorSqliteWorkspaceRoot(root);
}
