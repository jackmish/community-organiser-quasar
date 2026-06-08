/** System tag folders at task root (default tags; not user-removable). */
export const MEDIA_GALLERY_TAG_FOLDER_TO_REMOVE = '_ToRemove';
export const MEDIA_GALLERY_TAG_FOLDER_UNSUPPORTED = '_Unsupported';
export const MEDIA_GALLERY_TAG_FOLDER_BAD_QUALITY = '_BadQuality';

export const MEDIA_GALLERY_TAG_FOLDER_NAMES = [
  MEDIA_GALLERY_TAG_FOLDER_UNSUPPORTED,
  MEDIA_GALLERY_TAG_FOLDER_BAD_QUALITY,
  MEDIA_GALLERY_TAG_FOLDER_TO_REMOVE,
] as const;

export type MediaGallerySystemTagId = 'to_remove' | 'unsupported' | 'bad_quality';

export const MEDIA_GALLERY_SYSTEM_TAGS: ReadonlyArray<{
  id: MediaGallerySystemTagId;
  folderName: string;
  icon: string;
  color: string;
  labelKey: string;
}> = [
  {
    id: 'unsupported',
    folderName: MEDIA_GALLERY_TAG_FOLDER_UNSUPPORTED,
    icon: 'question_mark',
    color: 'warning',
    labelKey: 'files.gallery_tag_unsupported',
  },
  {
    id: 'bad_quality',
    folderName: MEDIA_GALLERY_TAG_FOLDER_BAD_QUALITY,
    icon: 'blur_on',
    color: 'grey',
    labelKey: 'files.gallery_tag_bad_quality',
  },
  {
    id: 'to_remove',
    folderName: MEDIA_GALLERY_TAG_FOLDER_TO_REMOVE,
    icon: 'delete',
    color: 'negative',
    labelKey: 'files.gallery_tag_to_remove',
  },
];

export function galleryTagFolderForId(tagId: MediaGallerySystemTagId): string {
  const tag = MEDIA_GALLERY_SYSTEM_TAGS.find((t) => t.id === tagId);
  return tag?.folderName ?? MEDIA_GALLERY_TAG_FOLDER_TO_REMOVE;
}
