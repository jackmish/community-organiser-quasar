import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { migrateDataLayoutIfNeeded } from '../../src-electron/dataLayoutMigration';
import { APP_DATA_PATH_SEGMENTS, CO21_SQLITE_DB_FILENAME } from '../../src/modules/storage/appDataPaths';

describe('dataLayoutMigration', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function makeRoot(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'co21-layout-'));
    roots.push(root);
    return root;
  }

  it('moves sqlite db into workspace/sqlite', () => {
    const root = makeRoot();
    fs.writeFileSync(path.join(root, CO21_SQLITE_DB_FILENAME), 'db');
    fs.writeFileSync(path.join(root, `${CO21_SQLITE_DB_FILENAME}-wal`), 'wal');

    migrateDataLayoutIfNeeded(root);

    const target = path.join(root, ...APP_DATA_PATH_SEGMENTS.sqlite, CO21_SQLITE_DB_FILENAME);
    expect(fs.existsSync(target)).toBe(true);
    expect(fs.existsSync(path.join(root, CO21_SQLITE_DB_FILENAME))).toBe(false);
  });

  it('renames storage to workspace and moves plugin folders', () => {
    const root = makeRoot();
    fs.mkdirSync(path.join(root, ...APP_DATA_PATH_SEGMENTS.legacyStorage, 'group'), {
      recursive: true,
    });
    fs.writeFileSync(path.join(root, ...APP_DATA_PATH_SEGMENTS.legacyStorage, 'group', 'group-a.json'), '{}');
    fs.mkdirSync(path.join(root, ...APP_DATA_PATH_SEGMENTS.legacyAttachmentsInStorage, 'g1'), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(root, ...APP_DATA_PATH_SEGMENTS.legacyAttachmentsInStorage, 'g1', 'a.txt'),
      'x',
    );
    fs.mkdirSync(path.join(root, ...APP_DATA_PATH_SEGMENTS.legacyHolidays), { recursive: true });
    fs.writeFileSync(path.join(root, ...APP_DATA_PATH_SEGMENTS.legacyHolidays, 'h.json'), '{}');
    fs.mkdirSync(path.join(root, ...APP_DATA_PATH_SEGMENTS.legacyMeteo), { recursive: true });
    fs.writeFileSync(path.join(root, ...APP_DATA_PATH_SEGMENTS.legacyMeteo, 'meteo_cache.json'), '{}');

    migrateDataLayoutIfNeeded(root);

    expect(fs.existsSync(path.join(root, ...APP_DATA_PATH_SEGMENTS.group, 'group-a.json'))).toBe(true);
    expect(
      fs.existsSync(path.join(root, ...APP_DATA_PATH_SEGMENTS.attachments, 'g1', 'a.txt')),
    ).toBe(true);
    expect(fs.existsSync(path.join(root, ...APP_DATA_PATH_SEGMENTS.pluginHolidays, 'h.json'))).toBe(
      true,
    );
    expect(
      fs.existsSync(path.join(root, ...APP_DATA_PATH_SEGMENTS.pluginMeteo, 'meteo_cache.json')),
    ).toBe(true);
    expect(fs.existsSync(path.join(root, ...APP_DATA_PATH_SEGMENTS.legacyStorage))).toBe(false);
  });

  it('renames co21 config folder to co21-config', () => {
    const root = makeRoot();
    fs.mkdirSync(path.join(root, ...APP_DATA_PATH_SEGMENTS.legacyCo21, 'access'), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(root, ...APP_DATA_PATH_SEGMENTS.legacyCo21SettingsFile),
      '{}',
    );

    migrateDataLayoutIfNeeded(root);

    expect(fs.existsSync(path.join(root, ...APP_DATA_PATH_SEGMENTS.co21SettingsFile))).toBe(true);
    expect(fs.existsSync(path.join(root, ...APP_DATA_PATH_SEGMENTS.legacyCo21))).toBe(false);
  });
});
