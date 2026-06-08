export type MediaGalleryThumbSize = 'small' | 'medium' | 'large' | 'xl';

export const MEDIA_GALLERY_THUMB_SIZE_STORAGE_KEY = 'co21.mediaGalleryThumbSize';

/** CSS tile size for medium gallery thumbs (large/xl multiply this). */
export const MEDIA_GALLERY_THUMB_BASE_PX = 220;

/** Matches `.media-folder-browser__entry-visual` / file-mode list layout. */
export const MEDIA_FILE_THUMB_DISPLAY_PX = 96;

/** Base edge for Sharp JPEG cache; tiers below multiply this (not screen pixels). */
export const MEDIA_THUMB_GEN_BASE = 160;

const VALID_SIZES: MediaGalleryThumbSize[] = ['small', 'medium', 'large', 'xl'];

const LEGACY_SIZE_MAP: Record<string, MediaGalleryThumbSize> = {
  compact: 'small',
  '1x': 'medium',
  '2x': 'large',
  '3x': 'xl',
};

/** Display tile multiplier (medium = 1× base, large = 2×, xl = 3×). */
const GALLERY_DISPLAY_MULTIPLIER: Record<MediaGalleryThumbSize, number> = {
  small: 1,
  medium: 1,
  large: 2,
  xl: 3,
};

/** Cache generation multiplier (small/file = 1× gen base, then +1 per step). */
const GALLERY_GEN_MULTIPLIER: Record<MediaGalleryThumbSize, number> = {
  small: 1,
  medium: 2,
  large: 3,
  xl: 4,
};

export function normalizeMediaGalleryThumbSize(value: unknown): MediaGalleryThumbSize {
  if (typeof value === 'string') {
    if ((VALID_SIZES as string[]).includes(value)) {
      return value as MediaGalleryThumbSize;
    }
    const legacy = LEGACY_SIZE_MAP[value];
    if (legacy) return legacy;
  }
  return 'medium';
}

/** On-screen gallery tile edge in px (CSS only; may upscale cached JPEGs). */
export function galleryThumbTilePx(size: MediaGalleryThumbSize): number {
  if (size === 'small') return MEDIA_FILE_THUMB_DISPLAY_PX;
  return MEDIA_GALLERY_THUMB_BASE_PX * GALLERY_DISPLAY_MULTIPLIER[size];
}

/** Sharp max edge = gen base × tier multiplier (fixed steps, not tied to tile px). */
export function galleryThumbGenMaxEdge(size: MediaGalleryThumbSize): number {
  return MEDIA_THUMB_GEN_BASE * GALLERY_GEN_MULTIPLIER[size];
}

export function fileModeThumbGenMaxEdge(): number {
  return MEDIA_THUMB_GEN_BASE;
}

export function loadMediaGalleryThumbSize(): MediaGalleryThumbSize {
  try {
    return normalizeMediaGalleryThumbSize(localStorage.getItem(MEDIA_GALLERY_THUMB_SIZE_STORAGE_KEY));
  } catch {
    return 'medium';
  }
}

export function saveMediaGalleryThumbSize(size: MediaGalleryThumbSize): void {
  try {
    localStorage.setItem(MEDIA_GALLERY_THUMB_SIZE_STORAGE_KEY, size);
  } catch {
    /* ignore */
  }
}
