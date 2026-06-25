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
  </div>
</template>

<script setup lang="ts">
import { $text } from 'src/modules/lang';

defineProps<{
  selectMode: boolean;
}>();

const emit = defineEmits<{
  'toggle-select': [];
}>();
</script>

<style scoped>
.media-face-panel {
  display: flex;
  align-items: center;
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
</style>
