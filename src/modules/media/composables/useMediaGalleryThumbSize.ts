import { ref, watch } from 'vue';
import {
  loadMediaGalleryThumbSize,
  saveMediaGalleryThumbSize,
  type MediaGalleryThumbSize,
} from '../mediaGalleryThumbSize';

export function useMediaGalleryThumbSize() {
  const galleryThumbSize = ref<MediaGalleryThumbSize>(loadMediaGalleryThumbSize());

  watch(galleryThumbSize, (size) => {
    saveMediaGalleryThumbSize(size);
  });

  return { galleryThumbSize };
}
