import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
  },
}));

import { Capacitor } from '@capacitor/core';
import {
  hasElectronFileStorage,
  isCapacitorNative,
  shouldUseCapacitorStorage,
} from 'src/modules/storage/backend/storagePlatform';

describe('storagePlatform', () => {
  const originalWindow = global.window;

  beforeEach(() => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    // @ts-expect-error test shim
    global.window = {};
  });

  afterEach(() => {
    global.window = originalWindow;
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
  });

  it('detects native Capacitor without Electron', () => {
    expect(isCapacitorNative()).toBe(true);
    expect(hasElectronFileStorage()).toBe(false);
    expect(shouldUseCapacitorStorage()).toBe(true);
  });

  it('prefers Electron appdata when electronAPI is present', () => {
    // @ts-expect-error test shim
    global.window = {
      electronAPI: {
        getAppDataPath: async () => '/tmp',
        writeFile: async () => true,
        joinPath: (...parts: string[]) => parts.join('/'),
      },
    };
    expect(shouldUseCapacitorStorage()).toBe(false);
  });
});
