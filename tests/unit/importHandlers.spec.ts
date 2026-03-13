/**
 * importHandlers.spec.ts
 *
 * Unit tests for createImportHandler.
 * The factory accepts injected dependencies, so this is pure logic with no
 * real storage or Quasar required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import type { Ref } from 'vue';
import { createImportHandler } from '../../src/modules/storage/importHandlers';

function makeStorage(overrides: Partial<Record<string, any>> = {}) {
  return {
    importFromFile: vi.fn(async () => ({ tasks: [], groups: [] })),
    saveData: vi.fn(async () => {}),
    loadData: vi.fn(async () => {}),
    ...overrides,
  };
}

function makeQuasar(overrides: Partial<Record<string, any>> = {}) {
  return {
    loading: { show: vi.fn(), hide: vi.fn() },
    notify: vi.fn(),
    ...overrides,
  };
}

describe('createImportHandler', () => {
  let reloadKey: Ref<number>;
  let showFirstRunDialog: Ref<boolean>;

  beforeEach(() => {
    reloadKey = ref(0);
    showFirstRunDialog = ref(true);
  });

  it('shows and hides loading, calls importFromFile/saveData/loadData, notifies success', async () => {
    const storage = makeStorage();
    const quasar = makeQuasar();
    const { handleImportFile } = createImportHandler({
      storage,
      quasar,
      reloadKey,
      showFirstRunDialog,
    });

    const file = new File(['{}'], 'data.json', { type: 'application/json' });
    await handleImportFile(file);

    expect(quasar.loading.show).toHaveBeenCalledOnce();
    expect(quasar.loading.hide).toHaveBeenCalledOnce();
    expect(storage.importFromFile).toHaveBeenCalledWith(file);
    expect(storage.saveData).toHaveBeenCalledOnce();
    expect(storage.loadData).toHaveBeenCalledOnce();
    expect(quasar.notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'positive' }));
  });

  it('increments reloadKey on success', async () => {
    reloadKey.value = 2;
    const { handleImportFile } = createImportHandler({
      storage: makeStorage(),
      quasar: makeQuasar(),
      reloadKey,
      showFirstRunDialog,
    });

    await handleImportFile(new File(['{}'], 'data.json'));

    expect(reloadKey.value).toBe(3);
  });

  it('clears showFirstRunDialog on success', async () => {
    showFirstRunDialog.value = true;
    const { handleImportFile } = createImportHandler({
      storage: makeStorage(),
      quasar: makeQuasar(),
      reloadKey,
      showFirstRunDialog,
    });

    await handleImportFile(new File(['{}'], 'data.json'));

    expect(showFirstRunDialog.value).toBe(false);
  });

  it('does not call saveData/loadData when importFromFile returns falsy', async () => {
    const storage = makeStorage({ importFromFile: vi.fn(async () => null) });
    const { handleImportFile } = createImportHandler({
      storage,
      quasar: makeQuasar(),
      reloadKey,
      showFirstRunDialog,
    });

    await handleImportFile(new File([''], 'empty.json'));

    expect(storage.saveData).not.toHaveBeenCalled();
    expect(storage.loadData).not.toHaveBeenCalled();
  });

  it('hides loading and notifies negative on error', async () => {
    const storage = makeStorage({
      importFromFile: vi.fn(async () => {
        throw new Error('bad zip');
      }),
    });
    const quasar = makeQuasar();
    const { handleImportFile } = createImportHandler({
      storage,
      quasar,
      reloadKey,
      showFirstRunDialog,
    });

    await handleImportFile(new File([''], 'bad.zip'));

    expect(quasar.loading.hide).toHaveBeenCalledOnce();
    expect(quasar.notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'negative', message: expect.stringContaining('bad zip') }),
    );
  });

  it('does not increment reloadKey on error', async () => {
    reloadKey.value = 5;
    const { handleImportFile } = createImportHandler({
      storage: makeStorage({
        importFromFile: vi.fn(async () => {
          throw new Error('oops');
        }),
      }),
      quasar: makeQuasar(),
      reloadKey,
      showFirstRunDialog,
    });

    await handleImportFile(new File([''], 'bad.zip'));

    expect(reloadKey.value).toBe(5);
  });
});
