import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getNoteAttachmentThumbUrl } from '../../src/modules/task/utils/noteTaskAttachmentThumbs';

vi.mock('../../src/modules/task/utils/noteTaskAttachmentStorage', () => ({
  materializeNoteAttachmentFile: vi.fn(),
}));

vi.mock('../../src/modules/media/mediaFolderService', () => ({
  getMediaThumbnail: vi.fn(),
}));

import { materializeNoteAttachmentFile } from '../../src/modules/task/utils/noteTaskAttachmentStorage';
import { getMediaThumbnail } from '../../src/modules/media/mediaFolderService';

describe('noteTaskAttachmentThumbs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('window', {
      electronAPI: {
        getAppDataPath: async () => '/data/workspace',
        getMediaThumbnail: vi.fn(),
      },
    });
  });

  it('returns data URL when thumbnails are unavailable', async () => {
    vi.stubGlobal('window', { electronAPI: undefined });
    const dataUrl = 'data:image/png;base64,abc';
    const result = await getNoteAttachmentThumbUrl({
      groupId: 'g1',
      taskId: 't1',
      name: 'scan.png',
      dataUrl,
    });
    expect(result).toEqual({ ok: true, url: dataUrl });
  });

  it('materializes and requests a cached thumb on desktop', async () => {
    vi.mocked(materializeNoteAttachmentFile).mockResolvedValue({
      ok: true,
      filePath: '/data/workspace/attachments/g1/t1/scan.png',
    });
    vi.mocked(getMediaThumbnail).mockResolvedValue({
      ok: true,
      url: 'media-thumb://cache/v1/ab/cd/hash.jpg',
    });

    const dataUrl = 'data:image/png;base64,abc';
    const result = await getNoteAttachmentThumbUrl({
      groupId: 'g1',
      taskId: 't1',
      name: 'scan.png',
      dataUrl,
      dataRoot: '/data/workspace',
    });

    expect(materializeNoteAttachmentFile).toHaveBeenCalled();
    expect(getMediaThumbnail).toHaveBeenCalledWith(
      '/data/workspace',
      '/data/workspace/attachments/g1/t1/scan.png',
      null,
      160,
    );
    expect(result).toEqual({
      ok: true,
      url: 'media-thumb://cache/v1/ab/cd/hash.jpg',
      filePath: '/data/workspace/attachments/g1/t1/scan.png',
    });
  });
});
