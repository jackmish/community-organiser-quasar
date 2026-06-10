<template>
  <div v-if="showNav" class="media-gallery-tag-folder-nav" @click.stop>
    <button
      type="button"
      class="media-gallery-tag-folder-nav__chip media-gallery-tag-folder-nav__chip--root"
      :class="{ 'media-gallery-tag-actions__btn--active': isAtGalleryRoot }"
      :title="$text('files.gallery_nav_root')"
      :aria-label="$text('files.gallery_nav_root')"
      :disabled="loading"
      @click="onNavigateRoot"
    >
      <q-icon name="home" size="16px" />
    </button>
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
      <span v-else-if="tag.id === 'unsupported'" class="media-gallery-tag-icon--unsupported">
        <q-icon name="insert_drive_file" size="13px" />
        <span class="media-gallery-tag-icon--unsupported-q">?</span>
      </span>
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
  normalizeMediaPath,
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

const showNav = computed(() => Boolean(String(props.rootPath || '').trim()));

const isAtGalleryRoot = computed(() => {
  const root = normalizeMediaPath(props.rootPath);
  const cur = normalizeMediaPath(props.currentPath || props.rootPath);
  return Boolean(root && cur === root);
});

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

function onNavigateRoot(): void {
  const root = String(props.rootPath || '').trim();
  if (!root) return;
  emit('navigate', root);
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
  flex-wrap: nowrap;
  justify-content: flex-end;
  gap: 4px;
  flex-shrink: 0;
}

.media-gallery-tag-folder-nav__chip:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.media-gallery-tag-folder-nav__chip--root {
  background: rgba(25, 118, 210, 0.12) !important;
  color: rgba(25, 118, 210, 0.95) !important;
}

.media-gallery-tag-folder-nav__chip--root:hover {
  background: rgba(25, 118, 210, 0.2) !important;
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
