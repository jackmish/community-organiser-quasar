<template>
  <div class="media-face-panel" @click.stop @pointerdown.stop>
    <q-btn
      square
      unelevated
      class="media-face-panel__select-btn"
      :class="{ 'media-face-panel__select-btn--active': selectMode }"
      :aria-label="$text('files.face_select_area')"
      :title="selectMode ? $text('files.face_select_area_active') : $text('files.face_select_area')"
      @click="emit('toggle-select')"
    >
      <q-icon name="crop_free" size="26px" :color="selectMode ? 'grey-10' : 'white'" />
    </q-btn>

    <button
      v-for="name in knownNames"
      :key="`known-${name}`"
      type="button"
      class="media-face-panel__person-btn"
      :class="{ 'media-face-panel__person-btn--active': highlightedLabel === name }"
      :title="name"
      @click="emit('highlight', name)"
    >
      {{ personInitial(name) }}
    </button>

    <div
      v-for="rect in annotations"
      :key="rect.id"
      class="media-face-panel__annotation"
      :class="{ 'media-face-panel__annotation--active': highlightedLabel && rect.label === highlightedLabel }"
    >
      <button
        type="button"
        class="media-face-panel__person-btn"
        :title="rect.label || $text('files.face_unnamed')"
        @click="emit('highlight', rect.label)"
      >
        {{ personInitial(rect.label || '?') }}
      </button>
      <q-btn
        unelevated
        square
        dense
        icon="close"
        color="negative"
        class="media-face-panel__remove-btn"
        :aria-label="$text('action.delete')"
        @click="emit('remove', rect.id)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { $text } from 'src/modules/lang';
import type { FaceAnnotationRect } from '../mediaFaceAnnotationModel';

defineProps<{
  selectMode: boolean;
  annotations: FaceAnnotationRect[];
  knownNames: string[];
  highlightedLabel: string;
}>();

const emit = defineEmits<{
  'toggle-select': [];
  highlight: [label: string];
  remove: [id: string];
}>();

function personInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return trimmed.slice(0, 1).toUpperCase();
}
</script>

<style scoped>
.media-face-panel {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
  pointer-events: auto;
}

.media-face-panel__select-btn {
  width: 44px;
  min-width: 44px;
  height: 44px;
  background: rgba(255, 255, 255, 0.16) !important;
  border: 2px solid rgba(255, 255, 255, 0.55);
}

.media-face-panel__select-btn--active {
  background: rgba(255, 193, 7, 0.92) !important;
  border-color: #ffca28;
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.35);
}

.media-face-panel__annotation {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.media-face-panel__annotation--active {
  background: rgba(255, 214, 102, 0.28);
  border-color: rgba(255, 214, 102, 0.75);
}

.media-face-panel__person-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin: 0;
  padding: 0;
  border: 2px solid rgba(255, 255, 255, 0.55);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
  font-size: 1rem;
  font-weight: 800;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.85);
  cursor: pointer;
}

.media-face-panel__person-btn:hover {
  background: rgba(255, 255, 255, 0.28);
}

.media-face-panel__person-btn--active {
  border-color: #ffca28;
  background: rgba(255, 193, 7, 0.42);
  color: #fff8e1;
}

.media-face-panel__remove-btn {
  width: 28px;
  min-width: 28px;
  height: 28px;
}
</style>
