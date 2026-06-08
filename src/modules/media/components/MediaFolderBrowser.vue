<template>
  <div
    class="media-folder-browser"
    :class="{
      'media-folder-browser--fill': fillAvailable,
      'media-folder-browser--gallery': useGalleryTiles,
    }"
    :style="galleryBrowserStyle"
  >
    <div class="media-folder-browser__toolbar">
      <q-btn
        dense
        flat
        round
        icon="arrow_upward"
        :disable="!canGoUp || loading"
        :title="$text('files.folder_up')"
        @click="goUp"
      />
      <div class="media-folder-browser__path text-caption text-grey-7 ellipsis" :title="currentPath">
        {{ displayPath }}
      </div>
      <q-option-group
        v-if="galleryLayout"
        v-model="galleryThumbSize"
        :options="galleryThumbSizeOptions"
        type="radio"
        inline
        dense
        class="media-folder-browser__thumb-size"
      />
      <div class="media-folder-browser__toolbar-actions">
        <q-btn
          dense
          flat
          round
          icon="refresh"
          :loading="loading"
          :title="$text('files.refresh')"
          @click="refresh"
        />
        <q-btn
          dense
          flat
          round
          icon="folder_open"
          :title="$text('files.open_in_explorer')"
          @click="openInExplorer"
        />
      </div>
    </div>

    <q-banner v-if="tagError" dense class="bg-negative text-white q-mb-sm" rounded>
      {{ tagError }}
      <template #action>
        <q-btn flat dense color="white" :label="$text('action.close')" @click="tagError = ''" />
      </template>
    </q-banner>

    <q-banner v-if="error" dense class="bg-negative text-white q-mb-sm" rounded>
      {{ error }}
    </q-banner>

    <div v-else class="media-folder-browser__list">
      <div v-if="loading" class="media-folder-browser__status text-grey-7">
        <q-spinner size="20px" class="q-mr-sm" />
        {{ $text('files.folder_loading') }}
      </div>
      <div v-else-if="!visibleEntries.length" class="media-folder-browser__status text-grey-7">
        {{ $text('files.folder_empty') }}
      </div>
      <template v-else>
        <button
          v-for="entry in visibleEntries"
          :key="entry.path"
          type="button"
          class="media-folder-browser__entry"
          :class="{ 'media-folder-browser__entry--gallery': useGalleryTiles }"
          @click="onEntryClick(entry)"
        >
          <template v-if="useGalleryTiles">
            <span class="media-folder-browser__gallery-tile">
              <span class="media-folder-browser__gallery-media">
                <img
                  v-if="entryThumb(entry)"
                  :src="entryThumb(entry)"
                  class="media-folder-browser__entry-thumb media-folder-browser__gallery-thumb"
                  alt=""
                />
                <q-spinner
                  v-else-if="showEntryThumb(entry)"
                  color="grey-6"
                  size="32px"
                />
                <q-icon
                  v-else
                  :name="entryIcon(entry)"
                  :color="entry.isDirectory ? 'amber-9' : 'grey-7'"
                  size="48px"
                />
                <MediaGalleryTagActions
                  v-if="galleryLayout && showGalleryTags(entry)"
                  :root-path="rootPath"
                  :file-path="entry.path"
                  :tags="galleryTags"
                  class="media-folder-browser__gallery-tag-actions"
                  @moved="onGalleryFileTagged"
                  @error="onGalleryTagError"
                />
              </span>
              <span class="media-folder-browser__gallery-info">
                <span class="media-folder-browser__gallery-info-row">
                  <span class="media-folder-browser__gallery-name" :title="entry.name">{{
                    entry.name
                  }}</span>
                  <q-btn
                    v-if="!entry.isDirectory"
                    dense
                    flat
                    round
                    size="xs"
                    icon="open_in_new"
                    class="media-folder-browser__entry-open"
                    :title="$text('files.open_file')"
                    @click.stop="openFile(entry.path)"
                  />
                </span>
                <span class="media-folder-browser__gallery-meta text-caption">
                  <span>{{ formatCreated(entry.createdMs) }}</span>
                  <span v-if="!entry.isDirectory" class="media-folder-browser__entry-size">
                    {{ formatSize(entry.size) }}
                  </span>
                </span>
              </span>
            </span>
          </template>
          <template v-else>
            <span class="media-folder-browser__entry-main">
              <template v-if="showEntryThumb(entry)">
                <span class="media-folder-browser__entry-visual">
                  <img
                    v-if="entryThumb(entry)"
                    :src="entryThumb(entry)"
                    class="media-folder-browser__entry-thumb"
                    alt=""
                  />
                  <q-spinner v-else color="grey-6" size="24px" />
                  <MediaGalleryTagActions
                    v-if="galleryLayout && showGalleryTags(entry)"
                    :root-path="rootPath"
                    :file-path="entry.path"
                    :tags="galleryTags"
                    class="media-folder-browser__entry-tag-actions"
                    @moved="onGalleryFileTagged"
                    @error="onGalleryTagError"
                  />
                </span>
              </template>
              <q-icon
                v-else
                :name="entryIcon(entry)"
                :color="entry.isDirectory ? 'amber-9' : 'grey-7'"
                size="20px"
              />
              <span class="media-folder-browser__entry-name">{{ entry.name }}</span>
              <q-btn
                v-if="!entry.isDirectory"
                dense
                flat
                round
                size="sm"
                icon="open_in_new"
                class="media-folder-browser__entry-open"
                :title="$text('files.open_file')"
                @click.stop="openFile(entry.path)"
              />
            </span>
            <span class="media-folder-browser__entry-meta text-caption text-grey-7">
              <span>{{ formatCreated(entry.createdMs) }}</span>
              <span v-if="!entry.isDirectory" class="media-folder-browser__entry-size">
                {{ formatSize(entry.size) }}
              </span>
            </span>
          </template>
        </button>
      </template>
    </div>

    <MediaGalleryPreviewDialog
      v-if="galleryLayout"
      :open="previewOpen"
      :root-path="rootPath"
      :entry="previewEntry"
      :entries="previewImageEntries"
      :fallback-thumb-url="previewFallbackThumbUrl || ''"
      :tags="galleryTags"
      @update:open="onPreviewOpenChange"
      @update:entry="previewEntry = $event"
      @moved="onGalleryFileTagged"
      @error="onGalleryTagError"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { $text, getLocale } from 'src/modules/lang';
import { useMediaGalleryThumbSize } from '../composables/useMediaGalleryThumbSize';
import {
  fileModeThumbGenMaxEdge,
  galleryThumbGenMaxEdge,
  galleryThumbTilePx,
} from '../mediaGalleryThumbSize';
import {
  resolveGalleryTagsForSet,
  type MediaGalleryTagSetConfig,
} from '../mediaGalleryTagModel';
import { useProgressiveMediaThumbs } from '../composables/useProgressiveMediaThumbs';
import MediaGalleryPreviewDialog from './MediaGalleryPreviewDialog.vue';
import MediaGalleryTagActions from './MediaGalleryTagActions.vue';
import {
  isImageFileName,
  isThumbableFileName,
  listMediaFolder,
  openMediaPath,
  revealMediaPath,
  type MediaFolderEntry,
} from '../mediaFolderService';

const props = defineProps<{
  rootPath: string;
  /** Gallery tasks: folders + image files only. */
  imagesOnly?: boolean;
  /** Gallery layout: larger thumbs and tile-oriented presentation. */
  galleryLayout?: boolean;
  /** Per-gallery tag configuration (MediaGallery tasks). */
  galleryTagSet?: MediaGalleryTagSetConfig | null;
  /** Fill parent height; file list scrolls inside. */
  fillAvailable?: boolean;
}>();

const loading = ref(false);
const error = ref('');
const tagError = ref('');
const previewOpen = ref(false);
const previewEntry = ref<MediaFolderEntry | null>(null);
const currentPath = ref('');
const parentPath = ref<string | null>(null);
const canGoUp = ref(false);
const entries = ref<MediaFolderEntry[]>([]);
const { thumbUrls, loadThumbs, reset: resetThumbs } = useProgressiveMediaThumbs();
const { galleryThumbSize } = useMediaGalleryThumbSize();

const galleryTags = computed(() => resolveGalleryTagsForSet(props.galleryTagSet));

const useGalleryTiles = computed(
  () => props.galleryLayout === true && galleryThumbSize.value !== 'small',
);

const galleryBrowserStyle = computed(() => {
  if (!useGalleryTiles.value) return undefined;
  const px = galleryThumbTilePx(galleryThumbSize.value);
  return { '--gallery-tile-size': `${px}px` };
});

const galleryThumbSizeOptions = computed(() => [
  { label: $text('files.gallery_thumb_small'), value: 'small' },
  { label: $text('files.gallery_thumb_medium'), value: 'medium' },
  { label: $text('files.gallery_thumb_large'), value: 'large' },
  { label: $text('files.gallery_thumb_xl'), value: 'xl' },
]);

const thumbMaxEdge = computed(() => {
  if (props.galleryLayout) {
    return galleryThumbGenMaxEdge(galleryThumbSize.value);
  }
  return fileModeThumbGenMaxEdge();
});

const displayPath = computed(() => currentPath.value || props.rootPath || '');

const previewFallbackThumbUrl = computed(() => {
  const entry = previewEntry.value;
  if (!entry) return undefined;
  return entryThumb(entry);
});

function showGalleryTags(entry: MediaFolderEntry): boolean {
  return !entry.isDirectory && isImageFileName(entry.name);
}

function onPreviewOpenChange(open: boolean): void {
  previewOpen.value = open;
  if (!open) previewEntry.value = null;
}

function openGalleryPreview(entry: MediaFolderEntry): void {
  if (!props.galleryLayout || !showGalleryTags(entry)) return;
  previewEntry.value = entry;
  previewOpen.value = true;
}

async function onGalleryFileTagged(): Promise<void> {
  tagError.value = '';
  const wasPreviewOpen = previewOpen.value;
  const oldIdx =
    previewEntry.value != null
      ? previewImageEntries.value.findIndex((e) => e.path === previewEntry.value!.path)
      : -1;

  if (wasPreviewOpen && oldIdx >= 0) {
    await refresh();
    const images = previewImageEntries.value;
    if (!images.length) {
      previewOpen.value = false;
      previewEntry.value = null;
      return;
    }
    const nextIdx = oldIdx >= images.length ? 0 : oldIdx;
    previewEntry.value = images[nextIdx] ?? null;
    if (!previewEntry.value) {
      previewOpen.value = false;
    }
    return;
  }

  previewOpen.value = false;
  previewEntry.value = null;
  await refresh();
}

function onGalleryTagError(message: string): void {
  tagError.value = message;
}

const visibleEntries = computed(() => {
  if (!props.imagesOnly) return entries.value;
  return entries.value.filter((e) => e.isDirectory || isImageFileName(e.name));
});

const previewImageEntries = computed(() =>
  visibleEntries.value.filter((entry) => showGalleryTags(entry)),
);

async function refresh(): Promise<void> {
  const root = String(props.rootPath || '').trim();
  if (!root) {
    error.value = $text('files.no_task_folder');
    entries.value = [];
    canGoUp.value = false;
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    const browsePath = currentPath.value || root;
    const result = await listMediaFolder(root, browsePath);
    if (!result.ok) {
      error.value = result.error;
      entries.value = [];
      canGoUp.value = false;
      parentPath.value = null;
      return;
    }
    currentPath.value = result.currentPath;
    parentPath.value = result.parentPath;
    canGoUp.value = result.canGoUp;
    entries.value = result.entries;
    resetThumbs();
    void loadThumbs(root, result.entries, thumbMaxEdge.value);
  } finally {
    loading.value = false;
  }
}

function goUp(): void {
  if (!canGoUp.value || loading.value || !parentPath.value) return;
  currentPath.value = parentPath.value;
  void refresh();
}

function onEntryClick(entry: MediaFolderEntry): void {
  if (entry.isDirectory) {
    currentPath.value = entry.path;
    void refresh();
    return;
  }
  if (props.galleryLayout && showGalleryTags(entry)) {
    openGalleryPreview(entry);
    return;
  }
  void openFile(entry.path);
}

async function openFile(targetPath: string): Promise<void> {
  const opened = await openMediaPath(targetPath);
  if (!opened.ok) {
    await revealMediaPath(targetPath);
  }
}

async function openInExplorer(): Promise<void> {
  const target = currentPath.value || props.rootPath;
  if (!target) return;
  await revealMediaPath(target);
}

function entryIcon(entry: MediaFolderEntry): string {
  if (entry.isDirectory) return 'folder';
  if (isImageFileName(entry.name)) return 'image';
  return 'insert_drive_file';
}

function entryThumb(entry: MediaFolderEntry): string | undefined {
  if (!showEntryThumb(entry)) return undefined;
  return thumbUrls.value[entry.path];
}

function showEntryThumb(entry: MediaFolderEntry): boolean {
  return !entry.isDirectory && isThumbableFileName(entry.name);
}

function formatSize(bytes: number | null | undefined): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCreated(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—';
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(getLocale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

watch(
  () => props.rootPath,
  () => {
    currentPath.value = String(props.rootPath || '').trim();
    parentPath.value = null;
    void refresh();
  },
  { immediate: true },
);

watch(thumbMaxEdge, () => {
  if (loading.value || !entries.value.length) return;
  resetThumbs();
  const root = String(props.rootPath || '').trim();
  if (!root) return;
  void loadThumbs(root, entries.value, thumbMaxEdge.value);
});
</script>

<style scoped>
.media-folder-browser--fill {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.media-folder-browser--fill .media-folder-browser__list {
  flex: 1 1 auto;
  min-height: 0;
  max-height: none;
  overflow-y: auto;
}

.media-folder-browser__toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
  margin-bottom: 8px;
}

.media-folder-browser__path {
  flex: 0 1 auto;
  min-width: 0;
  max-width: min(220px, 36vw);
}

.media-folder-browser__toolbar-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.media-folder-browser__list {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  align-items: flex-start;
  gap: 8px 10px;
  max-height: 280px;
  overflow-y: auto;
  padding: 8px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  box-sizing: border-box;
}

.media-folder-browser__status {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 8px 4px;
}

.media-folder-browser__thumb-size {
  flex: 0 0 auto;
}

.media-folder-browser__thumb-size :deep(.q-radio) {
  margin-right: 6px;
}

.media-folder-browser__thumb-size :deep(.q-radio:last-child) {
  margin-right: 0;
}

.media-folder-browser__entry {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  width: max-content;
  max-width: 100%;
  margin: 0;
  padding: 8px 10px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  text-align: left;
  font: inherit;
  color: inherit;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  transition: box-shadow 120ms ease, border-color 120ms ease;
}

.media-folder-browser__entry:hover {
  border-color: rgba(25, 118, 210, 0.45);
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.12);
}

.media-folder-browser__entry-main {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
}

.media-folder-browser__entry-visual {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 96px;
  height: 96px;
}

.media-folder-browser__entry-tag-actions {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 2;
}

.media-folder-browser__entry-thumb {
  display: block;
  max-width: 96px;
  max-height: 96px;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.04);
}

.media-folder-browser__entry-name {
  white-space: nowrap;
  font-weight: 600;
  line-height: 1.25;
}

.media-folder-browser__entry-open {
  flex-shrink: 0;
}

.media-folder-browser__entry-meta {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  margin-top: 4px;
  white-space: nowrap;
}

.media-folder-browser__entry-size::before {
  content: '·';
  margin-right: 10px;
  opacity: 0.55;
}

.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.media-folder-browser--gallery .media-folder-browser__list {
  gap: 14px 16px;
}

.media-folder-browser__entry--gallery {
  padding: 0;
  overflow: hidden;
  width: auto;
  background: #f0f0f0;
}

.media-folder-browser__gallery-tile {
  position: relative;
  display: block;
  width: var(--gallery-tile-size, 220px);
  height: var(--gallery-tile-size, 220px);
}

.media-folder-browser__gallery-media {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.04);
}

.media-folder-browser__gallery-tag-actions {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 2;
}

.media-folder-browser__gallery-thumb {
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  object-fit: cover;
  border-radius: 0;
  background: transparent;
}

.media-folder-browser__gallery-info {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(4px);
}

.media-folder-browser__gallery-info-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.media-folder-browser__gallery-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  font-size: 0.8125rem;
  line-height: 1.25;
  color: rgba(0, 0, 0, 0.88);
  text-shadow: 0 0 8px rgba(255, 255, 255, 0.85);
}

.media-folder-browser__gallery-meta {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  color: rgba(0, 0, 0, 0.72);
  line-height: 1.2;
  text-shadow: 0 0 6px rgba(255, 255, 255, 0.8);
}

.media-folder-browser__entry--gallery .media-folder-browser__entry-size::before {
  content: '·';
  margin-right: 10px;
  opacity: 0.55;
}
</style>
