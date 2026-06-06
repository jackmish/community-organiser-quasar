<template>
  <div class="media-folder-browser" :class="{ 'media-folder-browser--fill': fillAvailable }">
    <div class="media-folder-browser__toolbar row items-center q-col-gutter-xs q-mb-sm">
      <div class="col-auto">
        <q-btn
          dense
          flat
          round
          icon="arrow_upward"
          :disable="!canGoUp || loading"
          :title="$text('files.folder_up')"
          @click="goUp"
        />
      </div>
      <div class="col">
        <div class="text-caption text-grey-7 ellipsis" :title="currentPath">
          {{ displayPath }}
        </div>
      </div>
      <div class="col-auto row no-wrap" style="gap: 4px">
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

    <div v-if="imagesOnly" class="text-caption text-grey-7 q-mb-sm">
      {{ $text('files.gallery_browser_hint') }}
    </div>

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
          @click="onEntryClick(entry)"
        >
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
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { $text, getLocale } from 'src/modules/lang';
import { useProgressiveMediaThumbs } from '../composables/useProgressiveMediaThumbs';
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
  /** Fill parent height; file list scrolls inside. */
  fillAvailable?: boolean;
}>();

const loading = ref(false);
const error = ref('');
const currentPath = ref('');
const parentPath = ref<string | null>(null);
const canGoUp = ref(false);
const entries = ref<MediaFolderEntry[]>([]);
const { thumbUrls, loadThumbs, reset: resetThumbs } = useProgressiveMediaThumbs();

const displayPath = computed(() => currentPath.value || props.rootPath || '');

const visibleEntries = computed(() => {
  if (!props.imagesOnly) return entries.value;
  return entries.value.filter((e) => e.isDirectory || isImageFileName(e.name));
});

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
    void loadThumbs(root, result.entries);
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 96px;
  height: 96px;
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
</style>
