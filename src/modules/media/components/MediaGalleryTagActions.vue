<template>
  <span class="media-gallery-tag-actions" @click.stop>
    <q-btn
      v-for="tag in tags"
      :key="tag.id"
      dense
      flat
      square
      unelevated
      :icon="podiumPlace(tag) ? undefined : tag.icon || undefined"
      :label="podiumPlace(tag) ? String(podiumPlace(tag)) : undefined"
      no-caps
      :loading="busyTagId === tag.id"
      :disable="busyTagId != null && busyTagId !== tag.id"
      :title="tagTitle(tag)"
      :aria-label="tagTitle(tag)"
      :class="[
        'media-gallery-tag-actions__btn',
        `media-gallery-tag-actions__btn--${tag.id}`,
        { 'media-gallery-tag-actions__btn--podium': podiumPlace(tag) != null },
      ]"
      @click.stop="void applyTag(tag)"
    />
  </span>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { $text } from 'src/modules/lang';
import { applyMediaGalleryTag } from '../mediaFolderService';
import {
  galleryTagToAction,
  podiumPlace,
  type MediaGalleryTagDefinition,
} from '../mediaGalleryTagModel';

const props = defineProps<{
  rootPath: string;
  filePath: string;
  tags: MediaGalleryTagDefinition[];
}>();

const emit = defineEmits<{
  moved: [];
  error: [message: string];
}>();

const busyTagId = ref<string | null>(null);

function tagTitle(tag: MediaGalleryTagDefinition): string {
  return $text(tag.labelKey);
}

async function applyTag(tag: MediaGalleryTagDefinition): Promise<void> {
  if (busyTagId.value) return;
  const root = String(props.rootPath || '').trim();
  const filePath = String(props.filePath || '').trim();
  if (!root || !filePath) return;

  busyTagId.value = tag.id;
  try {
    const result = await applyMediaGalleryTag(root, filePath, galleryTagToAction(tag));
    if (!result.ok) {
      emit('error', result.error || $text('files.gallery_tag_move_failed'));
      return;
    }
    emit('moved');
  } finally {
    busyTagId.value = null;
  }
}
</script>

<style scoped>
.media-gallery-tag-actions {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 4px;
  max-width: min(220px, 42vw);
  pointer-events: auto;
}

.media-gallery-tag-actions__btn {
  width: 30px;
  min-width: 30px;
  height: 30px;
  min-height: 30px;
  padding: 0;
  border-radius: 0;
}

.media-gallery-tag-actions__btn--podium {
  font-weight: 800;
}

.media-gallery-tag-actions__btn--unsupported {
  background: rgba(255, 193, 7, 0.82) !important;
  color: rgba(0, 0, 0, 0.88) !important;
}

.media-gallery-tag-actions__btn--unsupported:hover {
  background: rgba(255, 193, 7, 0.92) !important;
}

.media-gallery-tag-actions__btn--bad_quality {
  background: rgba(97, 97, 97, 0.82) !important;
  color: #fff !important;
}

.media-gallery-tag-actions__btn--bad_quality:hover {
  background: rgba(66, 66, 66, 0.92) !important;
}

.media-gallery-tag-actions__btn--to_remove {
  background: rgba(211, 47, 47, 0.82) !important;
  color: #fff !important;
}

.media-gallery-tag-actions__btn--to_remove:hover {
  background: rgba(211, 47, 47, 0.92) !important;
}

/* 1st — gold */
.media-gallery-tag-actions__btn--rate_1 {
  background: linear-gradient(180deg, #f5d565 0%, #d4af37 55%, #b8962e 100%) !important;
  color: rgba(0, 0, 0, 0.88) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
}

.media-gallery-tag-actions__btn--rate_1:hover {
  background: linear-gradient(180deg, #ffe082 0%, #e0c040 55%, #c9a227 100%) !important;
}

/* 2nd — silver */
.media-gallery-tag-actions__btn--rate_2 {
  background: linear-gradient(180deg, #e8e8e8 0%, #c0c0c0 55%, #9e9e9e 100%) !important;
  color: rgba(0, 0, 0, 0.88) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45);
}

.media-gallery-tag-actions__btn--rate_2:hover {
  background: linear-gradient(180deg, #f5f5f5 0%, #d0d0d0 55%, #b0b0b0 100%) !important;
}

/* 3rd — bronze */
.media-gallery-tag-actions__btn--rate_3 {
  background: linear-gradient(180deg, #e8a86b 0%, #cd7f32 55%, #a86428 100%) !important;
  color: #fff !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.media-gallery-tag-actions__btn--rate_3:hover {
  background: linear-gradient(180deg, #f0b87d 0%, #d98940 55%, #b56f2e 100%) !important;
}
</style>
