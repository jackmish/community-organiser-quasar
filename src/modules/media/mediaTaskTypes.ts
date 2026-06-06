export const MEDIA_TASK_TYPE = {
  Files: 'MediaFiles',
  Gallery: 'MediaGallery',
  Link: 'MediaLink',
} as const;

export type MediaTaskTypeId = (typeof MEDIA_TASK_TYPE)[keyof typeof MEDIA_TASK_TYPE];

export const MEDIA_TASK_TYPE_IDS: MediaTaskTypeId[] = [
  MEDIA_TASK_TYPE.Files,
  MEDIA_TASK_TYPE.Gallery,
  MEDIA_TASK_TYPE.Link,
];

export const DEFAULT_MEDIA_TASK_TYPE_ID: MediaTaskTypeId = MEDIA_TASK_TYPE.Files;

export const LAST_MEDIA_TASK_TYPE_STORAGE_KEY = 'coq:lastMediaTaskType';

export function isMediaTaskTypeId(typeId: string | null | undefined): typeId is MediaTaskTypeId {
  if (!typeId) return false;
  return (MEDIA_TASK_TYPE_IDS as readonly string[]).includes(typeId);
}

export function isTodoLikeTaskTypeId(typeId: string | null | undefined): boolean {
  if (!typeId) return false;
  return typeId === 'Todo' || isMediaTaskTypeId(typeId);
}

export function showsMediaSharedFolderPicker(typeId: string | null | undefined): boolean {
  return (
    typeId === MEDIA_TASK_TYPE.Files || typeId === MEDIA_TASK_TYPE.Gallery
  );
}
