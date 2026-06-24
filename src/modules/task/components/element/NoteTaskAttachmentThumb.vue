<template>
  <div
    v-if="visible"
    class="note-attachment-thumb"
    :class="{
      'note-attachment-thumb--clickable': clickable,
      'note-attachment-thumb--loading': loading,
    }"
    :style="rootStyle"
    :role="clickable ? 'button' : undefined"
    :tabindex="clickable ? 0 : undefined"
    @click="onClick"
    @keydown.enter.prevent="onClick"
    @keydown.space.prevent="onClick"
  >
    <img
      v-if="thumbUrl"
      :src="thumbUrl"
      :alt="altText"
      class="note-attachment-thumb__img"
    />
    <q-spinner v-else-if="loading" color="grey-6" size="24px" />
    <q-icon v-else name="attach_file" size="28px" color="grey-7" />
    <span v-if="showCount && fileCount > 1" class="note-attachment-thumb__count">
      {{ fileCount }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { TaskAttachment } from 'src/modules/task/models/TaskModel';
import { MEDIA_FILE_THUMB_DISPLAY_PX } from 'src/modules/media/mediaGalleryThumbSize';
import {
  countTaskAttachments,
  firstImageTaskAttachment,
  isImageDataUrl,
  type NoteTaskMediaSource,
} from 'src/modules/task/utils/noteTaskMedia';
import { getNoteAttachmentThumbUrl } from 'src/modules/task/utils/noteTaskAttachmentThumbs';

const props = withDefaults(
  defineProps<{
    task?: NoteTaskMediaSource;
    taskId?: string;
    groupId?: string;
    /** When set, thumb this attachment instead of the first image on the task. */
    attachment?: TaskAttachment | null;
    sizePx?: number;
    showCount?: boolean;
    clickable?: boolean;
  }>(),
  {
    task: null,
    taskId: '',
    groupId: '',
    attachment: null,
    sizePx: MEDIA_FILE_THUMB_DISPLAY_PX,
    showCount: true,
    clickable: false,
  },
);

const emit = defineEmits<{
  (e: 'click'): void;
  (e: 'thumb-loaded', payload: { url: string; filePath?: string }): void;
}>();

const thumbUrl = ref('');
const loading = ref(false);
let loadGen = 0;

const fileCount = computed(() => countTaskAttachments(props.task));

const targetAttachment = computed((): TaskAttachment | null => {
  if (props.attachment) return props.attachment;
  return firstImageTaskAttachment(props.task);
});

const visible = computed(() => {
  if (props.attachment) return true;
  return fileCount.value > 0;
});

const altText = computed(() => targetAttachment.value?.name || 'attachment');

const rootStyle = computed(() => ({
  width: `${props.sizePx}px`,
  height: `${props.sizePx}px`,
}));

function onClick(): void {
  if (!props.clickable) return;
  emit('click');
}

async function loadThumb(): Promise<void> {
  const att = targetAttachment.value;
  const taskId = String(props.taskId || '').trim();
  const groupId = String(props.groupId || 'ungrouped').trim();
  if (!att || !taskId) {
    thumbUrl.value = isImageDataUrl(att?.dataUrl || '') ? att!.dataUrl : '';
    return;
  }

  if (!isImageDataUrl(att.dataUrl)) {
    thumbUrl.value = '';
    return;
  }

  const gen = ++loadGen;
  loading.value = true;
  try {
    const result = await getNoteAttachmentThumbUrl({
      groupId,
      taskId,
      name: att.name,
      dataUrl: att.dataUrl,
      ...(att.filePath ? { existingFilePath: att.filePath } : {}),
    });
    if (gen !== loadGen) return;
    if (result.ok) {
      thumbUrl.value = result.url;
      emit('thumb-loaded', { url: result.url, ...(result.filePath ? { filePath: result.filePath } : {}) });
    } else {
      thumbUrl.value = att.dataUrl;
    }
  } finally {
    if (gen === loadGen) loading.value = false;
  }
}

watch(
  () => [
    props.taskId,
    props.groupId,
    props.attachment?.dataUrl,
    props.attachment?.filePath,
    props.attachment?.name,
    targetAttachment.value?.dataUrl,
    targetAttachment.value?.filePath,
  ],
  () => {
    void loadThumb();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  loadGen += 1;
});
</script>

<style scoped>
.note-attachment-thumb {
  position: relative;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.note-attachment-thumb--clickable {
  cursor: pointer;
}

.note-attachment-thumb--clickable:focus-visible {
  outline: 2px solid var(--q-primary);
  outline-offset: 2px;
}

.note-attachment-thumb__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.note-attachment-thumb__count {
  position: absolute;
  right: 4px;
  bottom: 4px;
  min-width: 20px;
  padding: 0 5px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.72);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
}
</style>
