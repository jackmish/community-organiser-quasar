import { getContrastColor } from 'src/utils/colorUtils';
import {
  GROUP_DEFAULT_BACKGROUND,
  GROUP_DEFAULT_TEXT_COLOR,
} from 'src/modules/group/constants/groupPaletteColors';

function normHex(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return s.length ? s : undefined;
}

/** Ensure synced/imported groups have usable background + text colors. */
export function normalizeGroupStyleFields(fields: {
  color?: string | undefined;
  textColor?: string | undefined;
}): { color?: string; textColor?: string } {
  let color = normHex(fields.color);
  let textColor = normHex(fields.textColor);

  if (color && (color === '#fff' || color === '#ffffff') && !textColor) {
    textColor = GROUP_DEFAULT_TEXT_COLOR;
  }

  if (color && !textColor) {
    textColor = getContrastColor(color);
  }

  if (!color && textColor) {
    color = GROUP_DEFAULT_BACKGROUND;
  }

  return {
    ...(color ? { color } : {}),
    ...(textColor ? { textColor } : {}),
  };
}

export function mergeGroupStyleFields(
  existing: { color?: string; textColor?: string },
  incoming: { color?: string; textColor?: string },
): { color?: string; textColor?: string } {
  const color = normHex(incoming.color) ?? normHex(existing.color);
  const textColor = normHex(incoming.textColor) ?? normHex(existing.textColor);
  return normalizeGroupStyleFields({ color, textColor });
}
