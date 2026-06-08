export type MediaGalleryThumbSize = 'small' | 'medium' | 'large' | 'xl';

export const MEDIA_GALLERY_THUMB_SIZE_STORAGE_KEY = 'co21.mediaGalleryThumbSize';

export const MEDIA_GALLERY_THUMB_BASE_PX = 220;

const VALID_SIZES: MediaGalleryThumbSize[] = ['small', 'medium', 'large', 'xl'];

const LEGACY_SIZE_MAP: Record<string, MediaGalleryThumbSize> = {
  compact: 'small',
  '1x': 'medium',
  '2x': 'large',
  '3x': 'xl',
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

export function galleryThumbTilePx(size: MediaGalleryThumbSize): number {
  switch (size) {
    case 'large':
      return MEDIA_GALLERY_THUMB_BASE_PX * 2;
    case 'xl':
      return MEDIA_GALLERY_THUMB_BASE_PX * 3;
    case 'medium':
      return MEDIA_GALLERY_THUMB_BASE_PX;
    default:
      return MEDIA_GALLERY_THUMB_BASE_PX;
  }
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
