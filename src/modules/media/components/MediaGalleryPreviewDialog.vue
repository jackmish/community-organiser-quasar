<template>
  <q-dialog
    :model-value="open"
    maximized
    transition-show="fade"
    transition-hide="fade"
    @update:model-value="onDialogToggle"
  >
    <div class="media-gallery-preview" @click="close">
      <div class="media-gallery-preview__header">
        <div class="media-gallery-preview__title ellipsis">{{ entry?.name }}</div>
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
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { $text } from 'src/modules/lang';
import { getMediaFullImageUrl, type MediaFolderEntry } from '../mediaFolderService';
import MediaGalleryTagActions from './MediaGalleryTagActions.vue';

const props = defineProps<{
  open: boolean;
  rootPath: string;
  entry: MediaFolderEntry | null;
  fallbackThumbUrl?: string;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  moved: [];
  error: [message: string];
}>();

const imageUrl = ref('');
const loading = ref(false);
let loadGen = 0;

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

watch(
  () => [props.open, props.entry?.path, props.rootPath] as const,
  () => {
    void loadFullImage();
  },
  { immediate: true },
);

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
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.92);
  color: #fff;
}

.media-gallery-preview__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  padding: 8px 8px 8px 16px;
}

.media-gallery-preview__title {
  font-weight: 600;
  min-width: 0;
}

.media-gallery-preview__stage {
  position: relative;
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 8px 16px 24px;
  cursor: zoom-out;
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

.media-gallery-preview__image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  cursor: default;
  user-select: none;
}

.media-gallery-preview__tags {
  position: absolute;
  top: 56px;
  right: 16px;
  z-index: 2;
}
</style>
