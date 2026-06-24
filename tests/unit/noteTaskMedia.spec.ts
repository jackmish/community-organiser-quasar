import { describe, expect, it } from 'vitest';
import {
  collectNoteGraphicItems,
  isLongNoteDescription,
  shouldShowNoteGraphicHero,
} from '../../src/modules/task/utils/noteTaskMedia';

describe('noteTaskMedia', () => {
  it('shows graphic hero for a single image and short description', () => {
    const task = {
      type_id: 'NoteLater',
      name: 'Scan',
      description: 'Receipt',
      attachments: [
        {
          name: 'receipt.png',
          dataUrl: 'data:image/png;base64,abc',
        },
      ],
    };
    expect(shouldShowNoteGraphicHero(task)).toBe(true);
    expect(collectNoteGraphicItems(task)).toHaveLength(1);
  });

  it('hides graphic hero when description is long', () => {
    const task = {
      type_id: 'NoteLater',
      name: 'Scan',
      description: 'x'.repeat(200),
      photo: 'data:image/jpeg;base64,abc',
    };
    expect(shouldShowNoteGraphicHero(task)).toBe(false);
  });

  it('treats multi-line descriptions as long', () => {
    expect(isLongNoteDescription('one\ntwo\nthree')).toBe(true);
  });
});
