/** Built-in infoscreen display modes. */
export const INFOSCREEN_VARIANT_IDS = ['layout-drift', 'wall-clock'] as const;

export type InfoscreenVariantId = (typeof INFOSCREEN_VARIANT_IDS)[number];

export type InfoscreenVariantDef = {
  id: InfoscreenVariantId;
  labelKey: string;
};

export const INFOSCREEN_VARIANTS: InfoscreenVariantDef[] = [
  {
    id: 'layout-drift',
    labelKey: 'infoscreen.variant.layout_drift',
  },
  {
    id: 'wall-clock',
    labelKey: 'infoscreen.variant.wall_clock',
  },
];

/** Layout drift tuning (only used when variant is layout-drift). */
export const LAYOUT_DRIFT_STEP_INTERVAL_SECONDS = 90;
export const LAYOUT_DRIFT_MAX_SHIFT_PX = 3;

export function isInfoscreenVariantId(value: unknown): value is InfoscreenVariantId {
  return typeof value === 'string' && (INFOSCREEN_VARIANT_IDS as readonly string[]).includes(value);
}

export function normalizeInfoscreenVariantId(value: unknown): InfoscreenVariantId {
  if (isInfoscreenVariantId(value)) return value;
  if (value === 'simple-carousel') return 'layout-drift';
  return defaultInfoscreenVariantId();
}

export function defaultInfoscreenVariantId(): InfoscreenVariantId {
  return 'wall-clock';
}

export function getInfoscreenVariantDef(id: InfoscreenVariantId): InfoscreenVariantDef {
  return INFOSCREEN_VARIANTS.find((v) => v.id === id) ?? INFOSCREEN_VARIANTS[0]!;
}
