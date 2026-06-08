<template>
  <span class="media-gallery-tag-actions" @click.stop>
    <q-btn
      v-for="tag in tags"
      :key="tag.id"
      dense
      flat
      square
      unelevated
      :icon="tag.icon"
      :loading="busyTagId === tag.id"
      :disable="busyTagId != null && busyTagId !== tag.id"
      :title="tagTitle(tag)"
      :aria-label="tagTitle(tag)"
      :class="[
        'media-gallery-tag-actions__btn',
        `media-gallery-tag-actions__btn--${tag.id}`,
        { 'media-gallery-tag-actions__btn--star': tag.stars != null },
      ]"
      @click.stop="void applyTag(tag)"
    >
      <span v-if="tag.stars != null" class="media-gallery-tag-actions__star-label">{{
        tag.stars
      }}</span>
    </q-btn>
  </span>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { $text } from 'src/modules/lang';
import { applyMediaGalleryTag } from '../mediaFolderService';
import {
  galleryTagToAction,
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

.media-gallery-tag-actions__btn--star {
  position: relative;
}

.media-gallery-tag-actions__star-label {
  position: absolute;
  bottom: 2px;
  right: 3px;
  font-size: 0.55rem;
  font-weight: 800;
  line-height: 1;
  pointer-events: none;
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

.media-gallery-tag-actions__btn--rate_1 {
  background: rgba(255, 202, 40, 0.88) !important;
  color: rgba(0, 0, 0, 0.88) !important;
}

.media-gallery-tag-actions__btn--rate_2 {
  background: rgba(255, 160, 0, 0.88) !important;
  color: rgba(0, 0, 0, 0.88) !important;
}

.media-gallery-tag-actions__btn--rate_3 {
  background: rgba(239, 108, 0, 0.9) !important;
  color: #fff !important;
}
</style>
