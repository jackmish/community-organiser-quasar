import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';
import { sqliteDbNameForCapacitorWorkspace } from 'src/modules/space/capacitorSpacePaths';
import logger from 'src/utils/logger';
import { SQLITE_INIT_SCHEMA } from '../sqliteSchema';

let sqliteConnection: SQLiteConnection | null = null;
let dbConnection: SQLiteDBConnection | null = null;
let openPromise: Promise<SQLiteDBConnection> | null = null;
let sqliteAvailable: boolean | null = null;
let activeWorkspaceRoot = '';
let activeDbName = sqliteDbNameForCapacitorWorkspace('');

export function isCapacitorSqlitePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export async function isCapacitorSqliteAvailable(): Promise<boolean> {
  if (!isCapacitorSqlitePlatform()) return false;
  if (sqliteAvailable !== null) return sqliteAvailable;
  try {
    const conn = getSqliteConnection();
    await conn.checkConnectionsConsistency();
    sqliteAvailable = true;
    return true;
  } catch (err) {
    logger.warn('[capacitorSqlite] plugin unavailable', err);
    sqliteAvailable = false;
    return false;
  }
}

function getSqliteConnection(): SQLiteConnection {
  if (!sqliteConnection) {
    sqliteConnection = new SQLiteConnection(CapacitorSQLite);
  }
  return sqliteConnection;
}

export async function setCapacitorSqliteWorkspaceRoot(workspaceRoot: string): Promise<void> {
  const nextName = sqliteDbNameForCapacitorWorkspace(workspaceRoot);
  if (activeWorkspaceRoot === workspaceRoot && activeDbName === nextName && dbConnection) {
    const open = await dbConnection.isDBOpen();
    if (open.result) return;
  }

  if (dbConnection) {
    try {
      const open = await dbConnection.isDBOpen();
      if (open.result) {
        await dbConnection.close();
      }
    } catch (err) {
      logger.warn('[capacitorSqlite] close failed', err);
    }
    try {
      await getSqliteConnection().closeConnection(activeDbName, false);
    } catch (err) {
      logger.warn('[capacitorSqlite] closeConnection failed', err);
    }
    dbConnection = null;
  }

  activeWorkspaceRoot = workspaceRoot;
  activeDbName = nextName;
}

async function ensureConnection(): Promise<SQLiteDBConnection> {
  if (dbConnection) {
    const open = await dbConnection.isDBOpen();
    if (open.result) return dbConnection;
    dbConnection = null;
  }

  if (openPromise) return openPromise;

  openPromise = (async () => {
    const conn = getSqliteConnection();
    try {
      await conn.checkConnectionsConsistency();
    } catch (err) {
      logger.warn('[capacitorSqlite] connection consistency check failed', err);
    }

    const isConn = await conn.isConnection(activeDbName, false);
    let db: SQLiteDBConnection;
    if (isConn.result) {
      db = await conn.retrieveConnection(activeDbName, false);
    } else {
      db = await conn.createConnection(activeDbName, false, 'no-encryption', 1, false);
    }

    const isOpen = await db.isDBOpen();
    if (!isOpen.result) {
      await db.open();
    }

    await db.execute(SQLITE_INIT_SCHEMA);
    dbConnection = db;
    return db;
  })();

  try {
    return await openPromise;
  } finally {
    openPromise = null;
  }
}

export async function openCapacitorSqliteDb(): Promise<SQLiteDBConnection> {
  return ensureConnection();
}

export async function capacitorSqliteDbExistsForWorkspace(workspaceRoot: string): Promise<boolean> {
  if (!(await isCapacitorSqliteAvailable())) return false;
  try {
    const conn = getSqliteConnection();
    const dbName = sqliteDbNameForCapacitorWorkspace(workspaceRoot);
    const res = await conn.isDatabase(dbName);
    return !!res.result;
  } catch {
    return false;
  }
}

export async function capacitorSqliteDbExists(): Promise<boolean> {
  return capacitorSqliteDbExistsForWorkspace(activeWorkspaceRoot);
}

export async function getCapacitorSqliteMeta(key: string): Promise<string | null> {
  const db = await ensureConnection();
  const res = await db.query('SELECT value FROM space_meta WHERE key = ?', [key]);
  const row = res.values?.[0] as { value?: string } | undefined;
  return typeof row?.value === 'string' ? row.value : null;
}

export async function setCapacitorSqliteMeta(key: string, value: string): Promise<void> {
  const db = await ensureConnection();
  await db.run(
    `INSERT INTO space_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

export async function loadGroupsFromCapacitorSqlite(): Promise<Record<string, unknown>[]> {
  const db = await ensureConnection();
  const res = await db.query('SELECT payload FROM groups');
  const groups: Record<string, unknown>[] = [];
  for (const row of res.values ?? []) {
    const payload = (row as { payload?: string }).payload;
    if (!payload) continue;
    try {
      const parsed: unknown = JSON.parse(payload);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        groups.push(parsed as Record<string, unknown>);
      }
    } catch (err) {
      logger.warn('[capacitorSqlite] invalid group payload', err);
    }
  }
  return groups;
}

export async function saveGroupsToCapacitorSqlite(groups: unknown[]): Promise<void> {
  const db = await ensureConnection();
  const now = new Date().toISOString();
  const incomingIds = new Set<string>();

  await db.beginTransaction();
  try {
    for (const group of groups) {
      if (!group || typeof group !== 'object') continue;
      const row = group as Record<string, unknown>;
      const id = typeof row.id === 'string' ? row.id.trim() : '';
      if (!id) continue;
      incomingIds.add(id);
      await db.run(
        `INSERT INTO groups (id, payload, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
        [id, JSON.stringify(row), now],
        false,
      );
    }

    const existing = await db.query('SELECT id FROM groups');
    for (const row of existing.values ?? []) {
      const id = (row as { id?: string }).id;
      if (id && !incomingIds.has(id)) {
        await db.run('DELETE FROM groups WHERE id = ?', [id], false);
      }
    }

    await db.commitTransaction();
  } catch (err) {
    await db.rollbackTransaction();
    throw err;
  }
}

export async function deleteGroupFromCapacitorSqlite(groupId: string): Promise<void> {
  const db = await ensureConnection();
  await db.run('DELETE FROM groups WHERE id = ?', [groupId]);
}

export async function loadAppSettingsFromCapacitorSqlite(): Promise<Record<string, unknown>> {
  const db = await ensureConnection();
  const res = await db.query('SELECT key, value FROM app_settings');
  const out: Record<string, unknown> = {};
  for (const row of res.values ?? []) {
    const key = (row as { key?: string }).key;
    const value = (row as { value?: string }).value;
    if (!key) continue;
    try {
      out[key] = value != null ? JSON.parse(value) : null;
    } catch {
      out[key] = value;
    }
  }
  return out;
}

export async function saveAppSettingsToCapacitorSqlite(
  settings: Record<string, unknown>,
): Promise<void> {
  const db = await ensureConnection();
  await db.beginTransaction();
  try {
    for (const [key, value] of Object.entries(settings)) {
      await db.run(
        `INSERT INTO app_settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, JSON.stringify(value ?? null)],
        false,
      );
    }
    await db.commitTransaction();
  } catch (err) {
    await db.rollbackTransaction();
    throw err;
  }
}

export async function loadCo21SettingsFromCapacitorSqlite(): Promise<Record<string, unknown>> {
  const db = await ensureConnection();
  const res = await db.query('SELECT payload FROM co21_settings WHERE id = 1');
  const row = res.values?.[0] as { payload?: string } | undefined;
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

export async function saveCo21SettingsToCapacitorSqlite(
  payload: Record<string, unknown>,
): Promise<void> {
  const db = await ensureConnection();
  await db.run(
    `INSERT INTO co21_settings (id, payload) VALUES (1, ?)
     ON CONFLICT(id) DO UPDATE SET payload = excluded.payload`,
    [JSON.stringify(payload)],
  );
}

export async function isCapacitorSqliteReady(): Promise<boolean> {
  if (!(await isCapacitorSqliteAvailable())) return false;
  try {
    await ensureConnection();
    return true;
  } catch {
    return false;
  }
}
