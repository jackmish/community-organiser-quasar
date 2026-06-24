import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  migrateChromiumProfileLayout,
  migrateLegacyChromiumProfileDir,
} from '../../src-electron/electronProfilePaths';

describe('electronProfilePaths', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function makeProfileRoot(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'co21-profile-'));
    roots.push(root);
    return root;
  }

  it('sweeps orphaned chromium folders while keeping co21 workspace data', () => {
    const profileRoot = makeProfileRoot();
    const chromiumDir = path.join(profileRoot, 'app-data');
    fs.mkdirSync(path.join(profileRoot, 'co21-config'), { recursive: true });
    fs.mkdirSync(path.join(profileRoot, 'workspace', 'group'), { recursive: true });
    fs.mkdirSync(path.join(profileRoot, 'Cache'), { recursive: true });
    fs.mkdirSync(path.join(profileRoot, 'Crashpad'), { recursive: true });
    fs.mkdirSync(path.join(profileRoot, 'Dictionaries'), { recursive: true });
    fs.writeFileSync(path.join(profileRoot, 'Trust Tokens-journal'), '');

    migrateChromiumProfileLayout(profileRoot, chromiumDir);

    expect(fs.existsSync(path.join(profileRoot, 'co21-config'))).toBe(true);
    expect(fs.existsSync(path.join(profileRoot, 'workspace', 'group'))).toBe(true);
    expect(fs.existsSync(path.join(chromiumDir, 'Cache'))).toBe(true);
    expect(fs.existsSync(path.join(chromiumDir, 'Crashpad'))).toBe(true);
    expect(fs.existsSync(path.join(chromiumDir, 'Dictionaries'))).toBe(true);
    expect(fs.existsSync(path.join(chromiumDir, 'Trust Tokens-journal'))).toBe(true);
    expect(fs.existsSync(path.join(profileRoot, 'Cache'))).toBe(false);
  });

  it('removes stale profile-root duplicates when app/ already has the folder', () => {
    const profileRoot = makeProfileRoot();
    const chromiumDir = path.join(profileRoot, 'app-data');
    fs.mkdirSync(path.join(chromiumDir, 'Cache'), { recursive: true });
    fs.writeFileSync(path.join(chromiumDir, 'Cache', 'active.bin'), 'live');
    fs.mkdirSync(path.join(profileRoot, 'Cache'), { recursive: true });
    fs.writeFileSync(path.join(profileRoot, 'Cache', 'stale.bin'), 'old');
    fs.mkdirSync(path.join(profileRoot, 'Crashpad'), { recursive: true });
    fs.mkdirSync(path.join(chromiumDir, 'Crashpad'), { recursive: true });

    migrateChromiumProfileLayout(profileRoot, chromiumDir);

    expect(fs.existsSync(path.join(profileRoot, 'Cache'))).toBe(false);
    expect(fs.existsSync(path.join(profileRoot, 'Crashpad'))).toBe(false);
    expect(fs.readFileSync(path.join(chromiumDir, 'Cache', 'active.bin'), 'utf8')).toBe('live');
    expect(fs.readFileSync(path.join(chromiumDir, 'Cache', 'stale.bin'), 'utf8')).toBe('old');
  });

  it('renames legacy app profile dir to app-data', () => {
    const profileRoot = makeProfileRoot();
    const legacyDir = path.join(profileRoot, 'app');
    fs.mkdirSync(path.join(legacyDir, 'GPUCache'), { recursive: true });
    fs.writeFileSync(path.join(legacyDir, 'GPUCache', 'cached.bin'), 'gpu');

    const targetDir = migrateLegacyChromiumProfileDir(profileRoot);

    expect(targetDir).toBe(path.join(profileRoot, 'app-data'));
    expect(fs.existsSync(legacyDir)).toBe(false);
    expect(fs.readFileSync(path.join(targetDir, 'GPUCache', 'cached.bin'), 'utf8')).toBe('gpu');
  });
});
