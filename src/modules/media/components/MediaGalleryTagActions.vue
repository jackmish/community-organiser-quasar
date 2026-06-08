<template>
  <span class="media-gallery-tag-actions" @click.stop>
    <q-btn
      v-for="tag in MEDIA_GALLERY_SYSTEM_TAGS"
      :key="tag.id"
      dense
      flat
      square
      unelevated
      :icon="tag.icon"
      :loading="busyTagId === tag.id"
      :disable="busyTagId != null && busyTagId !== tag.id"
      :title="$text(tag.labelKey)"
      :aria-label="$text(tag.labelKey)"
      :class="[
        'media-gallery-tag-actions__btn',
        `media-gallery-tag-actions__btn--${tag.id}`,
      ]"
      @click.stop="void applyTag(tag.id)"
    />
  </span>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { $text } from 'src/modules/lang';
import { moveMediaToTagFolder } from '../mediaFolderService';
import {
  galleryTagFolderForId,
  MEDIA_GALLERY_SYSTEM_TAGS,
  type MediaGallerySystemTagId,
} from '../mediaGalleryTags';

const props = defineProps<{
  rootPath: string;
  filePath: string;
}>();

const emit = defineEmits<{
  moved: [];
  error: [message: string];
}>();

const busyTagId = ref<MediaGallerySystemTagId | null>(null);

async function applyTag(tagId: MediaGallerySystemTagId): Promise<void> {
  if (busyTagId.value) return;
  const root = String(props.rootPath || '').trim();
  const filePath = String(props.filePath || '').trim();
  if (!root || !filePath) return;

  busyTagId.value = tagId;
  try {
    const result = await moveMediaToTagFolder(root, filePath, galleryTagFolderForId(tagId));
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
  gap: 4px;
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
</style>
