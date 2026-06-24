import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import logger from 'src/utils/logger';
import { APP_DATA_PATH_SEGMENTS, CO21_SQLITE_DB_FILENAME } from '../src/modules/storage/appDataPaths';
import type { SpaceMigrateResult } from '../src/modules/space/models/SpaceModel';

const dbByDataPath = new Map<string, Database.Database>();

function legacySqliteDbPathForDataRoot(dataPath: string): string {
  return path.join(dataPath, CO21_SQLITE_DB_FILENAME);
}

export function sqliteDbPathForDataRoot(dataPath: string): string {
  return path.join(dataPath, ...APP_DATA_PATH_SEGMENTS.sqlite, CO21_SQLITE_DB_FILENAME);
}

export function sqliteDbExists(dataPath: string): boolean {
  return (
    fs.existsSync(sqliteDbPathForDataRoot(dataPath)) ||
    fs.existsSync(legacySqliteDbPathForDataRoot(dataPath))
  );
}

function resolveSqliteDbPathForOpen(dataPath: string): string {
  const canonical = sqliteDbPathForDataRoot(dataPath);
  if (fs.existsSync(canonical)) return canonical;
  const legacy = legacySqliteDbPathForDataRoot(dataPath);
  if (fs.existsSync(legacy)) return legacy;
  return canonical;
}

function openDb(dataPath: string): Database.Database {
  const key = path.resolve(dataPath);
  const existing = dbByDataPath.get(key);
  if (existing) return existing;
  const dbPath = resolveSqliteDbPathForOpen(key);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initSchema(db);
  dbByDataPath.set(key, db);
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS space_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS co21_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      payload TEXT NOT NULL
    );
  `);
}

function readJsonFileIfExists(filePath: string): unknown {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    if (!raw.trim()) return null;
    return JSON.parse(raw) as unknown;
  } catch (e) {
    logger.warn('[spaceSqlite] read json failed', filePath, e);
    return null;
  }
}

function isGroupJsonFilename(file: string): boolean {
  const lower = file.toLowerCase();
  return lower.startsWith('group-') && lower.endsWith('.json');
}

/** Copy existing JSON files into co21.db; does not delete source files. */
export function migrateFilesToSqlite(dataPath: string): SpaceMigrateResult {
  const root = path.resolve(dataPath);
  const db = openDb(root);
  const now = new Date().toISOString();

  const insertGroup = db.prepare(`
    INSERT INTO groups (id, payload, updated_at) VALUES (@id, @payload, @updated_at)
    ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
  `);
  const upsertSetting = db.prepare(`
    INSERT INTO app_settings (key, value) VALUES (@key, @value)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  const upsertCo21 = db.prepare(`
    INSERT INTO co21_settings (id, payload) VALUES (1, @payload)
    ON CONFLICT(id) DO UPDATE SET payload = excluded.payload
  `);
  const upsertMeta = db.prepare(`
    INSERT INTO space_meta (key, value) VALUES (@key, @value)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);

  let groupCount = 0;
  const groupDir = path.join(root, ...APP_DATA_PATH_SEGMENTS.group);
  if (fs.existsSync(groupDir)) {
    for (const file of fs.readdirSync(groupDir)) {
      if (!isGroupJsonFilename(file)) continue;
      const parsed = readJsonFileIfExists(path.join(groupDir, file));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
      const row = parsed as Record<string, unknown>;
      const id =
        (typeof row.id === 'string' && row.id.trim()) ||
        file.slice('group-'.length, -'.json'.length).trim();
      if (!id) continue;
      insertGroup.run({
        id,
        payload: JSON.stringify(row),
        updated_at: now,
      });
      groupCount += 1;
    }
  }

  let settingsKeyCount = 0;
  const settingsParsed = readJsonFileIfExists(
    path.join(root, ...APP_DATA_PATH_SEGMENTS.organiserSettingsFile),
  );
  if (settingsParsed && typeof settingsParsed === 'object' && !Array.isArray(settingsParsed)) {
    for (const [key, value] of Object.entries(settingsParsed as Record<string, unknown>)) {
      upsertSetting.run({ key, value: JSON.stringify(value ?? null) });
      settingsKeyCount += 1;
    }
  }

  let co21SettingsImported = false;
  const co21Parsed = readJsonFileIfExists(
    path.join(root, ...APP_DATA_PATH_SEGMENTS.co21SettingsFile),
  );
  if (!co21Parsed || typeof co21Parsed !== 'object' || Array.isArray(co21Parsed)) {
    const legacyCo21 = readJsonFileIfExists(
      path.join(root, ...APP_DATA_PATH_SEGMENTS.legacyCo21SettingsFile),
    );
    if (legacyCo21 && typeof legacyCo21 === 'object' && !Array.isArray(legacyCo21)) {
      upsertCo21.run({ payload: JSON.stringify(legacyCo21) });
      co21SettingsImported = true;
    }
  } else {
    upsertCo21.run({ payload: JSON.stringify(co21Parsed) });
    co21SettingsImported = true;
  }

  upsertMeta.run({ key: 'migratedFrom', value: 'files' });
  upsertMeta.run({ key: 'migratedAt', value: now });

  return {
    groupCount,
    settingsKeyCount,
    co21SettingsImported,
    dbPath: sqliteDbPathForDataRoot(root),
  };
}

export function loadGroupsFromSqlite(dataPath: string): Record<string, unknown>[] {
  const db = openDb(dataPath);
  const rows = db.prepare('SELECT payload FROM groups').all() as { payload: string }[];
  const groups: Record<string, unknown>[] = [];
  for (const row of rows) {
    try {
      const parsed: unknown = JSON.parse(row.payload);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        groups.push(parsed as Record<string, unknown>);
      }
    } catch (e) {
      logger.warn('[spaceSqlite] invalid group payload', e);
    }
  }
  return groups;
}

export function saveGroupsToSqlite(dataPath: string, groups: unknown[]): void {
  const db = openDb(dataPath);
  const now = new Date().toISOString();
  const upsert = db.prepare(`
    INSERT INTO groups (id, payload, updated_at) VALUES (@id, @payload, @updated_at)
    ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
  `);
  const deleteStmt = db.prepare('DELETE FROM groups WHERE id = ?');

  const incomingIds = new Set<string>();
  const tx = db.transaction(() => {
    for (const group of groups) {
      if (!group || typeof group !== 'object') continue;
      const row = group as Record<string, unknown>;
      const id = typeof row.id === 'string' ? row.id.trim() : '';
      if (!id) continue;
      incomingIds.add(id);
      upsert.run({ id, payload: JSON.stringify(row), updated_at: now });
    }
    const existing = db.prepare('SELECT id FROM groups').all() as { id: string }[];
    for (const { id } of existing) {
      if (!incomingIds.has(id)) deleteStmt.run(id);
    }
  });
  tx();
}

export function deleteGroupFromSqlite(dataPath: string, groupId: string): void {
  const db = openDb(dataPath);
  db.prepare('DELETE FROM groups WHERE id = ?').run(groupId);
}

export function loadAppSettingsFromSqlite(dataPath: string): Record<string, unknown> {
  const db = openDb(dataPath);
  const rows = db.prepare('SELECT key, value FROM app_settings').all() as {
    key: string;
    value: string;
  }[];
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      out[row.key] = JSON.parse(row.value) as unknown;
    } catch {
      out[row.key] = row.value;
    }
  }
  return out;
}

export function saveAppSettingsToSqlite(dataPath: string, settings: Record<string, unknown>): void {
  const db = openDb(dataPath);
  const upsert = db.prepare(`
    INSERT INTO app_settings (key, value) VALUES (@key, @value)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  const tx = db.transaction(() => {
    for (const [key, value] of Object.entries(settings)) {
      upsert.run({ key, value: JSON.stringify(value ?? null) });
    }
  });
  tx();
}

export function loadCo21SettingsFromSqlite(dataPath: string): Record<string, unknown> {
  const db = openDb(dataPath);
  const row = db.prepare('SELECT payload FROM co21_settings WHERE id = 1').get() as
    | { payload: string }
    | undefined;
  if (!row?.payload) return {};
  try {
    const parsed: unknown = JSON.parse(row.payload);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function saveCo21SettingsToSqlite(
  dataPath: string,
  payload: Record<string, unknown>,
): void {
  const db = openDb(dataPath);
  db.prepare(`
    INSERT INTO co21_settings (id, payload) VALUES (1, @payload)
    ON CONFLICT(id) DO UPDATE SET payload = excluded.payload
  `).run({ payload: JSON.stringify(payload) });
}

export function closeSqliteForDataPath(dataPath: string): void {
  const key = path.resolve(dataPath);
  const db = dbByDataPath.get(key);
  if (db) {
    try {
      db.close();
    } catch {
      void 0;
    }
    dbByDataPath.delete(key);
  }
}
