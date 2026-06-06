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

    <q-list v-else bordered separator class="media-folder-browser__list">
      <q-item v-if="loading" dense>
        <q-item-section avatar>
          <q-spinner size="20px" />
        </q-item-section>
        <q-item-section class="text-grey-7">{{ $text('files.folder_loading') }}</q-item-section>
      </q-item>
      <q-item v-else-if="!visibleEntries.length" dense>
        <q-item-section class="text-grey-7">{{ $text('files.folder_empty') }}</q-item-section>
      </q-item>
      <template v-else>
        <q-item dense class="media-folder-browser__header text-caption text-grey-7">
          <q-item-section avatar />
          <q-item-section>{{ $text('files.col_name') }}</q-item-section>
          <q-item-section side class="media-folder-browser__date-col">
            {{ $text('files.col_created') }}
          </q-item-section>
          <q-item-section side class="media-folder-browser__size-col">
            {{ $text('files.col_size') }}
          </q-item-section>
          <q-item-section side class="media-folder-browser__actions-col" />
        </q-item>
        <q-item
          v-for="entry in visibleEntries"
          :key="entry.path"
          clickable
          v-ripple
          dense
          @click="onEntryClick(entry)"
        >
          <q-item-section avatar>
            <q-icon
              :name="entryIcon(entry)"
              :color="entry.isDirectory ? 'amber-9' : 'grey-7'"
            />
          </q-item-section>
          <q-item-section>
            <q-item-label class="ellipsis">{{ entry.name }}</q-item-label>
          </q-item-section>
          <q-item-section side class="media-folder-browser__date-col">
            <q-item-label caption class="media-folder-browser__date">
              {{ formatCreated(entry.createdMs) }}
            </q-item-label>
          </q-item-section>
          <q-item-section side class="media-folder-browser__size-col">
            <q-item-label caption>
              {{ entry.isDirectory ? '—' : formatSize(entry.size) }}
            </q-item-label>
          </q-item-section>
          <q-item-section v-if="!entry.isDirectory" side class="media-folder-browser__actions-col">
            <q-btn
              dense
              flat
              round
              icon="open_in_new"
              :title="$text('files.open_file')"
              @click.stop="openFile(entry.path)"
            />
          </q-item-section>
          <q-item-section v-else side class="media-folder-browser__actions-col" />
        </q-item>
      </template>
    </q-list>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { $text, getLocale } from 'src/modules/lang';
import {
  isImageFileName,
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
  if (props.imagesOnly && isImageFileName(entry.name)) return 'image';
  return 'insert_drive_file';
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
  max-height: 280px;
  overflow-y: auto;
  border-radius: 8px;
}

.media-folder-browser__header {
  min-height: 32px;
  pointer-events: none;
  user-select: none;
}

.media-folder-browser__date-col {
  min-width: 108px;
  text-align: right;
}

.media-folder-browser__size-col {
  min-width: 72px;
  text-align: right;
}

.media-folder-browser__actions-col {
  min-width: 40px;
}

.media-folder-browser__date {
  white-space: nowrap;
}

.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
