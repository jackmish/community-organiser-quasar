import fs from 'fs';
import path from 'path';
import logger from 'src/utils/logger';
import {
  APP_DATA_PATH_SEGMENTS,
  CO21_SQLITE_DB_FILENAME,
} from '../src/modules/storage/appDataPaths';

const migratedRoots = new Set<string>();

function pathKey(root: string): string {
  return path.resolve(root);
}

function moveFileIfNeeded(src: string, dest: string): void {
  if (!fs.existsSync(src) || fs.existsSync(dest)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.renameSync(src, dest);
}

function mergeDirectoryContents(srcDir: string, destDir: string): void {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir)) {
    const from = path.join(srcDir, entry);
    const to = path.join(destDir, entry);
    if (fs.existsSync(to)) continue;
    fs.renameSync(from, to);
  }
}

function moveDirectoryIfNeeded(dataRoot: string, fromSegments: string[], toSegments: string[]): void {
  const src = path.join(dataRoot, ...fromSegments);
  const dest = path.join(dataRoot, ...toSegments);
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.renameSync(src, dest);
    return;
  }
  mergeDirectoryContents(src, dest);
  try {
    fs.rmSync(src, { recursive: true, force: true });
  } catch (e) {
    logger.warn('[dataLayoutMigration] could not remove legacy dir', src, e);
  }
}

function migrateSqliteFiles(dataRoot: string): void {
  const targetDir = path.join(dataRoot, ...APP_DATA_PATH_SEGMENTS.sqlite);
  const legacyBase = path.join(dataRoot, CO21_SQLITE_DB_FILENAME);
  const targetBase = path.join(targetDir, CO21_SQLITE_DB_FILENAME);
  if (!fs.existsSync(legacyBase) || fs.existsSync(targetBase)) return;
  fs.mkdirSync(targetDir, { recursive: true });
  for (const suffix of ['', '-wal', '-shm']) {
    moveFileIfNeeded(`${legacyBase}${suffix}`, `${targetBase}${suffix}`);
  }
}

export function migrateCo21ConfigDirAtRoot(dataRoot: string): void {
  moveDirectoryIfNeeded(
    dataRoot,
    [...APP_DATA_PATH_SEGMENTS.legacyCo21],
    [...APP_DATA_PATH_SEGMENTS.co21Config],
  );
}

function migrateDataLayoutOnce(dataRoot: string): void {
  const key = pathKey(dataRoot);
  if (migratedRoots.has(key)) return;
  migratedRoots.add(key);

  if (!dataRoot || !fs.existsSync(dataRoot)) return;

  try {
    migrateCo21ConfigDirAtRoot(dataRoot);
    migrateSqliteFiles(dataRoot);
    moveDirectoryIfNeeded(
      dataRoot,
      [...APP_DATA_PATH_SEGMENTS.legacyAttachmentsInStorage],
      ['storage', 'attachments'],
    );
    moveDirectoryIfNeeded(
      dataRoot,
      [...APP_DATA_PATH_SEGMENTS.legacyStorage],
      [...APP_DATA_PATH_SEGMENTS.workspace],
    );
    moveDirectoryIfNeeded(
      dataRoot,
      [...APP_DATA_PATH_SEGMENTS.legacyAttachmentsInWorkspace],
      [...APP_DATA_PATH_SEGMENTS.attachments],
    );
    moveDirectoryIfNeeded(
      dataRoot,
      [...APP_DATA_PATH_SEGMENTS.legacyHolidays],
      [...APP_DATA_PATH_SEGMENTS.pluginHolidays],
    );
    moveDirectoryIfNeeded(
      dataRoot,
      [...APP_DATA_PATH_SEGMENTS.legacyMeteo],
      [...APP_DATA_PATH_SEGMENTS.pluginMeteo],
    );
    moveDirectoryIfNeeded(
      dataRoot,
      [...APP_DATA_PATH_SEGMENTS.legacyMediaThumbs],
      [...APP_DATA_PATH_SEGMENTS.mediaThumbs],
    );
  } catch (e) {
    logger.error('[dataLayoutMigration] failed for', dataRoot, e);
  }
}

export function migrateDataLayoutIfNeeded(dataRoot: string): void {
  migrateDataLayoutOnce(path.resolve(String(dataRoot || '').trim()));
}
