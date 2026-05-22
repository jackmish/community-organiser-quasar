import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  CSS_Z_INDEX_MAX,
  CSS_Z_INDEX_POPUP_OVER_DIALOG,
  popupZIndexAboveDialogs,
} from '../../src/utils/stackingZIndex';

describe('stackingZIndex', () => {
  let host: HTMLElement | null = null;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    host?.remove();
    document.querySelectorAll('.q-dialog.test-dialog').forEach((el) => el.remove());
  });

  it('defaults to popup-over-dialog layer', () => {
    expect(Number(popupZIndexAboveDialogs())).toBe(CSS_Z_INDEX_POPUP_OVER_DIALOG);
  });

  it('stacks above an open Quasar dialog z-index', () => {
    const dialog = document.createElement('div');
    dialog.className = 'q-dialog test-dialog';
    dialog.style.zIndex = '6100';
    host!.appendChild(dialog);
    expect(Number(popupZIndexAboveDialogs())).toBeGreaterThan(6100);
  });

  it('never exceeds CSS z-index max (below toasts)', () => {
    const dialog = document.createElement('div');
    dialog.className = 'q-dialog test-dialog';
    dialog.style.zIndex = String(CSS_Z_INDEX_MAX - 10);
    host!.appendChild(dialog);
    expect(Number(popupZIndexAboveDialogs())).toBeLessThan(CSS_Z_INDEX_MAX);
  });
});
