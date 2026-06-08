<template>
  <Teleport to="body">
    <q-dialog
      :model-value="open"
      maximized
      seamless
      class="media-gallery-preview-dialog"
      transition-show="fade"
      transition-hide="fade"
      @update:model-value="onDialogToggle"
    >
      <div class="media-gallery-preview" @click="close">
        <div class="media-gallery-preview__stage" @click.stop="close">
          <img
            v-if="imageUrl"
            :src="imageUrl"
            class="media-gallery-preview__image"
            :class="{ 'media-gallery-preview__image--loading': loading }"
            :alt="entry?.name || ''"
            @error="onImageError"
            @click.stop
          />
          <q-spinner v-else color="white" size="48px" />
          <q-spinner
            v-if="loading && imageUrl"
            color="white"
            size="32px"
            class="media-gallery-preview__loading"
          />
        </div>

        <button
          v-if="canGoPrev"
          type="button"
          class="media-gallery-preview__nav media-gallery-preview__nav--prev"
          :title="$text('files.gallery_preview_prev')"
          :aria-label="$text('files.gallery_preview_prev')"
          @click.stop="goPrev"
        >
          <q-icon name="chevron_left" size="56px" />
        </button>
        <button
          v-if="canGoNext"
          type="button"
          class="media-gallery-preview__nav media-gallery-preview__nav--next"
          :title="$text('files.gallery_preview_next')"
          :aria-label="$text('files.gallery_preview_next')"
          @click.stop="goNext"
        >
          <q-icon name="chevron_right" size="56px" />
        </button>

        <div class="media-gallery-preview__header">
          <div class="media-gallery-preview__title ellipsis">
            {{ entry?.name }}
            <span v-if="positionLabel" class="media-gallery-preview__position">{{ positionLabel }}</span>
          </div>
          <q-btn
            flat
            round
            dense
            icon="close"
            color="white"
            :aria-label="$text('action.close')"
            @click.stop="close"
          />
        </div>
        <MediaGalleryTagActions
          v-if="entry && rootPath"
          :root-path="rootPath"
          :file-path="entry.path"
          class="media-gallery-preview__tags"
          @moved="onTagged"
          @error="onTagError"
        />
      </div>
    </q-dialog>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { $text } from 'src/modules/lang';
import { getMediaFullImageUrl, type MediaFolderEntry } from '../mediaFolderService';
import MediaGalleryTagActions from './MediaGalleryTagActions.vue';

const props = defineProps<{
  open: boolean;
  rootPath: string;
  entry: MediaFolderEntry | null;
  entries?: MediaFolderEntry[];
  fallbackThumbUrl?: string;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  'update:entry': [entry: MediaFolderEntry];
  moved: [];
  error: [message: string];
}>();

const imageUrl = ref('');
const loading = ref(false);
let loadGen = 0;

const currentIndex = computed(() => {
  const entry = props.entry;
  if (!entry) return -1;
  return props.entries?.findIndex((item) => item.path === entry.path) ?? -1;
});

const canGoPrev = computed(() => currentIndex.value > 0);
const canGoNext = computed(() => {
  const idx = currentIndex.value;
  const total = props.entries?.length ?? 0;
  return idx >= 0 && idx < total - 1;
});

const positionLabel = computed(() => {
  const idx = currentIndex.value;
  const total = props.entries?.length ?? 0;
  if (idx < 0 || total <= 1) return '';
  return `${idx + 1} / ${total}`;
});

async function loadFullImage(): Promise<void> {
  const entry = props.entry;
  const root = String(props.rootPath || '').trim();
  if (!props.open || !entry || !root) {
    imageUrl.value = '';
    loading.value = false;
    return;
  }

  const gen = ++loadGen;
  loading.value = true;
  imageUrl.value = props.fallbackThumbUrl || '';
  const result = await getMediaFullImageUrl(root, entry.path);
  if (gen !== loadGen) return;
  loading.value = false;
  if (!result.ok) {
    if (!imageUrl.value) {
      emit('error', result.error || $text('files.gallery_preview_failed'));
    }
    return;
  }
  imageUrl.value = result.url;
}

function onImageError(): void {
  if (props.fallbackThumbUrl && imageUrl.value !== props.fallbackThumbUrl) {
    imageUrl.value = props.fallbackThumbUrl;
    return;
  }
  emit('error', $text('files.gallery_preview_failed'));
}

function goPrev(): void {
  if (!canGoPrev.value || !props.entries) return;
  const next = props.entries[currentIndex.value - 1];
  if (next) emit('update:entry', next);
}

function goNext(): void {
  if (!canGoNext.value || !props.entries) return;
  const next = props.entries[currentIndex.value + 1];
  if (next) emit('update:entry', next);
}

function onPreviewKeydown(event: KeyboardEvent): void {
  if (!props.open) return;
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    goPrev();
    return;
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    goNext();
  }
}

watch(
  () => [props.open, props.entry?.path, props.rootPath, props.fallbackThumbUrl] as const,
  () => {
    void loadFullImage();
  },
  { immediate: true },
);

watch(
  () => props.open,
  (open) => {
    if (open) {
      window.addEventListener('keydown', onPreviewKeydown);
    } else {
      window.removeEventListener('keydown', onPreviewKeydown);
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  window.removeEventListener('keydown', onPreviewKeydown);
});

function close(): void {
  emit('update:open', false);
}

function onDialogToggle(value: boolean): void {
  emit('update:open', value);
}

function onTagged(): void {
  emit('moved');
  close();
}

function onTagError(message: string): void {
  emit('error', message);
}
</script>

<style scoped>
.media-gallery-preview {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #000;
  color: #fff;
}

.media-gallery-preview__stage {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: zoom-out;
}

.media-gallery-preview__image {
  display: block;
  width: 100%;
  height: 100%;
  max-width: 100vw;
  max-height: 100vh;
  object-fit: contain;
  cursor: default;
  user-select: none;
}

.media-gallery-preview__image--loading {
  opacity: 0.55;
}

.media-gallery-preview__loading {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
}

.media-gallery-preview__nav {
  position: absolute;
  top: 50%;
  z-index: 4;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 140px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  cursor: pointer;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-50%);
  transition: opacity 140ms ease, visibility 140ms ease, background 120ms ease;
}

.media-gallery-preview__nav--prev {
  left: 0;
}

.media-gallery-preview__nav--next {
  right: 0;
}

.media-gallery-preview:hover .media-gallery-preview__nav,
.media-gallery-preview:focus-within .media-gallery-preview__nav {
  opacity: 1;
  visibility: visible;
}

.media-gallery-preview__nav:hover {
  background: rgba(0, 0, 0, 0.62);
}

.media-gallery-preview__header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 10px 28px 16px;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.72), rgba(0, 0, 0, 0));
  pointer-events: none;
}

.media-gallery-preview__header :deep(.q-btn) {
  pointer-events: auto;
}

.media-gallery-preview__title {
  font-weight: 600;
  min-width: 0;
  pointer-events: auto;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
}

.media-gallery-preview__position {
  margin-left: 8px;
  font-weight: 500;
  font-size: 0.875rem;
  opacity: 0.78;
}

.media-gallery-preview__tags {
  position: absolute;
  top: 12px;
  right: 52px;
  z-index: 4;
}
</style>

<style>
.media-gallery-preview-dialog .q-dialog__inner {
  padding: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  max-width: 100vw !important;
  max-height: 100vh !important;
}

.media-gallery-preview-dialog .q-dialog__inner > div {
  width: 100%;
  height: 100%;
}
</style>
