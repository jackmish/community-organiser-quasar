/** Largest valid CSS z-index (32-bit signed integer). */
export const CSS_Z_INDEX_MAX = 2_147_483_647;

/** Used in app.scss for notifications and tooltips — do not exceed. */
export const CSS_Z_INDEX_TOAST = CSS_Z_INDEX_MAX;

/**
 * Default layer for popups above Quasar dialogs (~6k+) but below toasts/tooltips.
 * Keep a margin below {@link CSS_Z_INDEX_MAX} (see day-organiser-page.scss).
 */
export const CSS_Z_INDEX_POPUP_OVER_DIALOG = 2_147_483_540;

const Z_MARGIN_ABOVE_DIALOG = 100;

function parseZIndex(el: Element | null | undefined): number {
  if (!el || !(el instanceof HTMLElement)) return 0;
  const raw = el.style.zIndex || window.getComputedStyle(el).zIndex;
  const z = parseInt(String(raw), 10);
  return Number.isFinite(z) ? z : 0;
}

/**
 * z-index for teleported menus / native color inputs above open dialogs.
 * Stays within CSS integer limits and below notification layer.
 */
export function popupZIndexAboveDialogs(anchor?: HTMLElement | null): string {
  let z = CSS_Z_INDEX_POPUP_OVER_DIALOG;

  for (const dialog of document.querySelectorAll<HTMLElement>('.q-dialog')) {
    z = Math.max(z, parseZIndex(dialog) + Z_MARGIN_ABOVE_DIALOG);
  }

  let walk: HTMLElement | null = anchor ?? null;
  while (walk) {
    if (walk.classList.contains('q-dialog')) {
      z = Math.max(z, parseZIndex(walk) + Z_MARGIN_ABOVE_DIALOG);
    }
    walk = walk.parentElement;
  }

  const capped = Math.min(z, CSS_Z_INDEX_TOAST - 50);
  return String(Math.max(capped, 7000));
}
