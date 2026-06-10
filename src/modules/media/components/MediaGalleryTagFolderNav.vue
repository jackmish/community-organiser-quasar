<template>
  <div v-if="navTags.length" class="media-gallery-tag-folder-nav" @click.stop>
    <button
      v-for="tag in navTags"
      :key="tag.id"
      type="button"
      class="media-gallery-tag-folder-nav__chip"
      :class="[
        `media-gallery-tag-actions__btn--${tag.id}`,
        {
          'media-gallery-tag-actions__btn--active': isActive(tag),
          'media-gallery-tag-actions__btn--podium': podiumPlace(tag) != null,
        },
      ]"
      :title="navTitle(tag)"
      :aria-label="navTitle(tag)"
      :disabled="loading"
      @click="onNavigate(tag)"
    >
      <q-icon name="folder" size="16px" class="media-gallery-tag-folder-nav__folder-icon" />
      <span v-if="chipLabel(tag)" class="media-gallery-tag-folder-nav__label">{{
        chipLabel(tag)
      }}</span>
      <q-icon v-else-if="tag.icon" :name="tag.icon" size="14px" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { $text } from 'src/modules/lang';
import {
  galleryTagFolderPath,
  isGalleryTagFolderPath,
  navigableGalleryTags,
  podiumPlace,
  type MediaGalleryTagDefinition,
} from '../mediaGalleryTagModel';

const props = defineProps<{
  rootPath: string;
  tags: MediaGalleryTagDefinition[];
  currentPath: string;
  loading?: boolean;
}>();

const emit = defineEmits<{
  navigate: [folderPath: string];
}>();

const navTags = computed(() => navigableGalleryTags(props.tags));

function isActive(tag: MediaGalleryTagDefinition): boolean {
  return isGalleryTagFolderPath(props.currentPath, props.rootPath, tag);
}

function chipLabel(tag: MediaGalleryTagDefinition): string | null {
  const place = podiumPlace(tag);
  return place != null ? String(place) : null;
}

function navTitle(tag: MediaGalleryTagDefinition): string {
  const folder = tag.folderName || tag.pathSegments?.join('/') || '';
  if (!folder) return $text('files.gallery_tag_open_folder');
  return `${$text('files.gallery_tag_open_folder')} ${folder}`;
}

function onNavigate(tag: MediaGalleryTagDefinition): void {
  const folderPath = galleryTagFolderPath(props.rootPath, tag);
  if (!folderPath) return;
  emit('navigate', folderPath);
}
</script>

<style scoped lang="scss">
@import '../mediaGalleryTagButtons.scss';

.media-gallery-tag-folder-nav {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 4px;
  max-width: min(280px, 48vw);
}

.media-gallery-tag-folder-nav__chip:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.media-gallery-tag-folder-nav__folder-icon {
  flex-shrink: 0;
  opacity: 0.92;
}

.media-gallery-tag-folder-nav__label {
  font-size: 0.8125rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.02em;
}
</style>
