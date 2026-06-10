/**
 * Per-gallery tag configuration (stored on MediaGallery tasks).
 *
 * Tag modes:
 * - single_folder: move file to one folder at task root
 * - multi_folder: copy or symlink into several root folders, then remove source
 * - hierarchical: move into nested folders under task root (segments joined)
 */

export type MediaGalleryTagMode = 'single_folder' | 'multi_folder' | 'hierarchical' | 'root';

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
  /** Podium place 1 (gold), 2 (silver), 3 (bronze) — shows number instead of icon. */
  podium?: 1 | 2 | 3;
  /** @deprecated Use `podium` */
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

const BUILTIN_PODIUM_TAGS: MediaGalleryTagDefinition[] = [
  {
    id: 'rate_1',
    mode: 'single_folder',
    folderName: MEDIA_GALLERY_TAG_FOLDER_RATE_1,
    icon: '',
    color: 'podium-gold',
    textColor: 'black',
    labelKey: 'files.gallery_tag_podium_1',
    builtIn: true,
    podium: 1,
  },
  {
    id: 'rate_2',
    mode: 'single_folder',
    folderName: MEDIA_GALLERY_TAG_FOLDER_RATE_2,
    icon: '',
    color: 'podium-silver',
    textColor: 'black',
    labelKey: 'files.gallery_tag_podium_2',
    builtIn: true,
    podium: 2,
  },
  {
    id: 'rate_3',
    mode: 'single_folder',
    folderName: MEDIA_GALLERY_TAG_FOLDER_RATE_3,
    icon: '',
    color: 'podium-bronze',
    textColor: 'white',
    labelKey: 'files.gallery_tag_podium_3',
    builtIn: true,
    podium: 3,
  },
];

export const DEFAULT_GALLERY_TAG_SET: MediaGalleryTagSetConfig = {
  enabledModes: ['single_folder'],
  tags: [...BUILTIN_PODIUM_TAGS, ...BUILTIN_SYSTEM_TAGS],
};

export const GALLERY_BACK_TO_ROOT_TAG_ID = 'back_to_root';

export const GALLERY_BACK_TO_ROOT_TAG: MediaGalleryTagDefinition = {
  id: GALLERY_BACK_TO_ROOT_TAG_ID,
  mode: 'root',
  icon: 'home',
  color: 'primary',
  textColor: 'white',
  labelKey: 'files.gallery_tag_back_to_root',
  builtIn: true,
};

const VALID_MODES: MediaGalleryTagMode[] = ['single_folder', 'multi_folder', 'hierarchical', 'root'];

function normalizeModes(value: unknown): MediaGalleryTagMode[] {
  if (!Array.isArray(value) || !value.length) return ['single_folder'];
  const modes = value.filter(
    (m): m is MediaGalleryTagMode =>
      typeof m === 'string' && (VALID_MODES as string[]).includes(m),
  );
  return modes.length ? modes : ['single_folder'];
}

function resolvePodiumPlace(t: Partial<MediaGalleryTagDefinition>): 1 | 2 | 3 | null {
  if (t.podium === 1 || t.podium === 2 || t.podium === 3) return t.podium;
  if (t.stars === 1 || t.stars === 2 || t.stars === 3) return t.stars;
  return null;
}

function mergeWithDefaultTags(custom: MediaGalleryTagDefinition[]): MediaGalleryTagDefinition[] {
  const defaults = DEFAULT_GALLERY_TAG_SET.tags ?? [];
  const byId = new Map<string, MediaGalleryTagDefinition>();
  for (const tag of defaults) {
    byId.set(tag.id, tag);
  }
  for (const tag of custom) {
    byId.set(tag.id, tag);
  }
  const defaultOrder = defaults.map((t) => t.id);
  const extraIds = custom.filter((t) => !defaultOrder.includes(t.id)).map((t) => t.id);
  return [...defaultOrder, ...extraIds]
    .map((id) => byId.get(id))
    .filter((t): t is MediaGalleryTagDefinition => t != null);
}

function normalizeTag(raw: unknown): MediaGalleryTagDefinition | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Partial<MediaGalleryTagDefinition>;
  if (typeof t.id !== 'string' || !t.id.trim()) return null;
  if (typeof t.labelKey !== 'string' || !t.labelKey.trim()) return null;
  const place = resolvePodiumPlace(t);
  if (typeof t.icon !== 'string') return null;
  if (!place && !t.icon.trim()) return null;
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
    ...(place ? { podium: place } : {}),
  };
}

export function podiumPlace(tag: MediaGalleryTagDefinition): 1 | 2 | 3 | null {
  if (tag.podium === 1 || tag.podium === 2 || tag.podium === 3) return tag.podium;
  if (tag.stars === 1 || tag.stars === 2 || tag.stars === 3) return tag.stars;
  return null;
}

/** Podium tags first (1→2→3), then everything else in original order. */
function sortGalleryTags(tags: MediaGalleryTagDefinition[]): MediaGalleryTagDefinition[] {
  const podium: MediaGalleryTagDefinition[] = [];
  const rest: MediaGalleryTagDefinition[] = [];
  for (const tag of tags) {
    if (podiumPlace(tag) != null) podium.push(tag);
    else rest.push(tag);
  }
  podium.sort((a, b) => podiumPlace(a)! - podiumPlace(b)!);
  return [...podium, ...rest];
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
    ? mergeWithDefaultTags(customTags)
    : [...(DEFAULT_GALLERY_TAG_SET.tags ?? [])];
  return { enabledModes, tags };
}

export function resolveGalleryTagsForSet(
  tagSet: MediaGalleryTagSetConfig | null | undefined,
): MediaGalleryTagDefinition[] {
  const normalized = normalizeGalleryTagSet(tagSet ?? DEFAULT_GALLERY_TAG_SET);
  const enabled = new Set(normalizeModes(normalized.enabledModes));
  return sortGalleryTags(
    (normalized.tags ?? []).filter((tag) => enabled.has(tag.mode)),
  );
}

/** File tagging buttons: gallery tags plus built-in “back to root”. */
export function galleryFileActionTags(
  tags: MediaGalleryTagDefinition[],
): MediaGalleryTagDefinition[] {
  if (tags.some((tag) => tag.mode === 'root')) return tags;
  return [...tags, GALLERY_BACK_TO_ROOT_TAG];
}

export function normalizeMediaPath(value: string): string {
  return String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '')
    .toLowerCase();
}

/** Absolute folder path for a navigable tag (single_folder / hierarchical). */
export function galleryTagFolderPath(
  rootPath: string,
  tag: MediaGalleryTagDefinition,
): string | null {
  const root = String(rootPath || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/$/, '');
  if (!root) return null;
  if (tag.mode === 'single_folder' && tag.folderName?.trim()) {
    return `${root}/${tag.folderName.trim()}`;
  }
  if (tag.mode === 'hierarchical' && tag.pathSegments?.length) {
    const segments = tag.pathSegments.map((s) => String(s || '').trim()).filter(Boolean);
    if (!segments.length) return null;
    return `${root}/${segments.join('/')}`;
  }
  return null;
}

export function isGalleryTagFolderPath(
  currentPath: string,
  rootPath: string,
  tag: MediaGalleryTagDefinition,
): boolean {
  const folderPath = galleryTagFolderPath(rootPath, tag);
  if (!folderPath) return false;
  const cur = normalizeMediaPath(currentPath);
  const folder = normalizeMediaPath(folderPath);
  if (!cur || !folder) return false;
  return cur === folder || cur.startsWith(`${folder}/`);
}

export function findGalleryTagForFolderName(
  folderName: string,
  tags: MediaGalleryTagDefinition[],
): MediaGalleryTagDefinition | null {
  const name = String(folderName || '').trim();
  if (!name) return null;
  return tags.find((tag) => tag.folderName === name) ?? null;
}

export function navigableGalleryTags(
  tags: MediaGalleryTagDefinition[],
): MediaGalleryTagDefinition[] {
  return tags.filter((tag) => galleryTagFolderPath('x', tag) != null);
}

export function galleryTagToAction(tag: MediaGalleryTagDefinition): MediaGalleryTagAction {
  const action: MediaGalleryTagAction = { mode: tag.mode };
  if (tag.folderName) action.folderName = tag.folderName;
  if (tag.folders?.length) action.folders = [...tag.folders];
  if (tag.linkMode) action.linkMode = tag.linkMode;
  if (tag.pathSegments?.length) action.pathSegments = [...tag.pathSegments];
  return action;
}
