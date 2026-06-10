<template>
  <span class="media-gallery-tag-actions" @click.stop>
    <q-btn
      v-for="tag in tags"
      :key="tag.id"
      dense
      flat
      square
      unelevated
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
    >
      <span v-if="tag.id === 'unsupported'" class="media-gallery-tag-icon--unsupported">
        <q-icon name="insert_drive_file" size="15px" />
        <span class="media-gallery-tag-icon--unsupported-q">?</span>
      </span>
      <template v-else-if="podiumPlace(tag)">{{ podiumPlace(tag) }}</template>
      <q-icon v-else-if="tag.icon" :name="tag.icon" size="18px" />
    </q-btn>
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

<style scoped lang="scss">
@import '../mediaGalleryTagButtons.scss';

.media-gallery-tag-actions {
  display: inline-flex;
  align-items: center;
  flex-wrap: nowrap;
  justify-content: flex-end;
  gap: 4px;
  pointer-events: auto;
}
</style>
