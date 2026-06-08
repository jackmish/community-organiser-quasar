/**
 * Per-gallery tag configuration (stored on MediaGallery tasks).
 *
 * Tag modes:
 * - single_folder: move file to one folder at task root
 * - multi_folder: copy or symlink into several root folders, then remove source
 * - hierarchical: move into nested folders under task root (segments joined)
 */

export type MediaGalleryTagMode = 'single_folder' | 'multi_folder' | 'hierarchical';

export type MediaGalleryTagLinkMode = 'copy' | 'symlink';

export type MediaGalleryTagDefinition = {
  id: string;
  mode: MediaGalleryTagMode;
  labelKey: string;
  icon: string;
  color: string;
  textColor?: 'white' | 'black';
  /** single_folder — folder name at task root */
  folderName?: string;
  /** multi_folder — folder names at task root */
  folders?: string[];
  linkMode?: MediaGalleryTagLinkMode;
  /** hierarchical — path segments under task root */
  pathSegments?: string[];
  builtIn?: boolean;
  stars?: 1 | 2 | 3;
};

export type MediaGalleryTagSetConfig = {
  /** Enabled tag modes for this gallery (default: single_folder only). */
  enabledModes?: MediaGalleryTagMode[];
  tags?: MediaGalleryTagDefinition[];
};

export type MediaGalleryTagAction = Pick<
  MediaGalleryTagDefinition,
  'mode' | 'folderName' | 'folders' | 'linkMode' | 'pathSegments'
>;

export const MEDIA_GALLERY_TAG_FOLDER_TO_REMOVE = '_ToRemove';
export const MEDIA_GALLERY_TAG_FOLDER_UNSUPPORTED = '_Unsupported';
export const MEDIA_GALLERY_TAG_FOLDER_BAD_QUALITY = '_BadQuality';
export const MEDIA_GALLERY_TAG_FOLDER_RATE_1 = '_Rate1';
export const MEDIA_GALLERY_TAG_FOLDER_RATE_2 = '_Rate2';
export const MEDIA_GALLERY_TAG_FOLDER_RATE_3 = '_Rate3';

const BUILTIN_SYSTEM_TAGS: MediaGalleryTagDefinition[] = [
  {
    id: 'bad_quality',
    mode: 'single_folder',
    folderName: MEDIA_GALLERY_TAG_FOLDER_BAD_QUALITY,
    icon: 'blur_on',
    color: 'grey-8',
    labelKey: 'files.gallery_tag_bad_quality',
    builtIn: true,
  },
  {
    id: 'unsupported',
    mode: 'single_folder',
    folderName: MEDIA_GALLERY_TAG_FOLDER_UNSUPPORTED,
    icon: 'question_mark',
    color: 'warning',
    textColor: 'black',
    labelKey: 'files.gallery_tag_unsupported',
    builtIn: true,
  },
  {
    id: 'to_remove',
    mode: 'single_folder',
    folderName: MEDIA_GALLERY_TAG_FOLDER_TO_REMOVE,
    icon: 'delete',
    color: 'negative',
    labelKey: 'files.gallery_tag_to_remove',
    builtIn: true,
  },
];

const BUILTIN_STAR_TAGS: MediaGalleryTagDefinition[] = [
  {
    id: 'rate_1',
    mode: 'single_folder',
    folderName: MEDIA_GALLERY_TAG_FOLDER_RATE_1,
    icon: 'star',
    color: 'amber-7',
    textColor: 'black',
    labelKey: 'files.gallery_tag_rate_1',
    builtIn: true,
    stars: 1,
  },
  {
    id: 'rate_2',
    mode: 'single_folder',
    folderName: MEDIA_GALLERY_TAG_FOLDER_RATE_2,
    icon: 'star',
    color: 'amber-9',
    textColor: 'black',
    labelKey: 'files.gallery_tag_rate_2',
    builtIn: true,
    stars: 2,
  },
  {
    id: 'rate_3',
    mode: 'single_folder',
    folderName: MEDIA_GALLERY_TAG_FOLDER_RATE_3,
    icon: 'star',
    color: 'orange-9',
    textColor: 'black',
    labelKey: 'files.gallery_tag_rate_3',
    builtIn: true,
    stars: 3,
  },
];

export const DEFAULT_GALLERY_TAG_SET: MediaGalleryTagSetConfig = {
  enabledModes: ['single_folder'],
  tags: [...BUILTIN_STAR_TAGS, ...BUILTIN_SYSTEM_TAGS],
};

const VALID_MODES: MediaGalleryTagMode[] = ['single_folder', 'multi_folder', 'hierarchical'];

function normalizeModes(value: unknown): MediaGalleryTagMode[] {
  if (!Array.isArray(value) || !value.length) return ['single_folder'];
  const modes = value.filter(
    (m): m is MediaGalleryTagMode =>
      typeof m === 'string' && (VALID_MODES as string[]).includes(m),
  );
  return modes.length ? modes : ['single_folder'];
}

function normalizeTag(raw: unknown): MediaGalleryTagDefinition | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Partial<MediaGalleryTagDefinition>;
  if (typeof t.id !== 'string' || !t.id.trim()) return null;
  if (typeof t.labelKey !== 'string' || !t.labelKey.trim()) return null;
  if (typeof t.icon !== 'string' || !t.icon.trim()) return null;
  if (typeof t.color !== 'string' || !t.color.trim()) return null;
  const mode = (VALID_MODES as string[]).includes(String(t.mode))
    ? (t.mode as MediaGalleryTagMode)
    : 'single_folder';
  return {
    id: t.id.trim(),
    mode,
    labelKey: t.labelKey.trim(),
    icon: t.icon.trim(),
    color: t.color.trim(),
    ...(t.textColor === 'black' || t.textColor === 'white' ? { textColor: t.textColor } : {}),
    ...(typeof t.folderName === 'string' && t.folderName.trim()
      ? { folderName: t.folderName.trim() }
      : {}),
    ...(Array.isArray(t.folders)
      ? {
          folders: t.folders
            .map((f) => String(f || '').trim())
            .filter(Boolean),
        }
      : {}),
    ...(t.linkMode === 'copy' || t.linkMode === 'symlink' ? { linkMode: t.linkMode } : {}),
    ...(Array.isArray(t.pathSegments)
      ? {
          pathSegments: t.pathSegments
            .map((s) => String(s || '').trim())
            .filter(Boolean),
        }
      : {}),
    ...(t.builtIn === true ? { builtIn: true } : {}),
    ...(t.stars === 1 || t.stars === 2 || t.stars === 3 ? { stars: t.stars } : {}),
  };
}

export function normalizeGalleryTagSet(value: unknown): MediaGalleryTagSetConfig {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_GALLERY_TAG_SET, tags: [...(DEFAULT_GALLERY_TAG_SET.tags ?? [])] };
  }
  const raw = value as MediaGalleryTagSetConfig;
  const enabledModes = normalizeModes(raw.enabledModes);
  const customTags = Array.isArray(raw.tags)
    ? raw.tags.map(normalizeTag).filter((t): t is MediaGalleryTagDefinition => t != null)
    : [];
  const tags = customTags.length
    ? customTags
    : [...(DEFAULT_GALLERY_TAG_SET.tags ?? [])];
  return { enabledModes, tags };
}

export function resolveGalleryTagsForSet(
  tagSet: MediaGalleryTagSetConfig | null | undefined,
): MediaGalleryTagDefinition[] {
  const normalized = normalizeGalleryTagSet(tagSet ?? DEFAULT_GALLERY_TAG_SET);
  const enabled = new Set(normalizeModes(normalized.enabledModes));
  return (normalized.tags ?? []).filter((tag) => enabled.has(tag.mode));
}

export function galleryTagToAction(tag: MediaGalleryTagDefinition): MediaGalleryTagAction {
  const action: MediaGalleryTagAction = { mode: tag.mode };
  if (tag.folderName) action.folderName = tag.folderName;
  if (tag.folders?.length) action.folders = [...tag.folders];
  if (tag.linkMode) action.linkMode = tag.linkMode;
  if (tag.pathSegments?.length) action.pathSegments = [...tag.pathSegments];
  return action;
}
