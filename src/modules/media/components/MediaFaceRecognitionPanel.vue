<template>
  <div class="media-face-panel" @click.stop @pointerdown.stop>
    <q-btn
      v-if="showAiStart"
      square
      unelevated
      class="media-face-panel__ai-btn"
      :loading="aiBusy"
      :aria-label="$text('files.face_backend_server_start')"
      :title="$text('files.face_backend_server_start')"
      @click="emit('start-backend-server')"
    >
      <q-icon name="dns" size="24px" color="white" />
    </q-btn>
    <q-btn
      v-else-if="aiHealthy"
      square
      unelevated
      class="media-face-panel__ai-btn media-face-panel__ai-btn--ready"
      :aria-label="$text('files.face_backend_server_ready')"
      :title="$text('files.face_backend_server_ready')"
      disable
    >
      <q-icon name="check_circle" size="22px" color="positive" />
    </q-btn>

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
import { computed } from 'vue';
import { $text } from 'src/modules/lang';

const props = defineProps<{
  selectMode: boolean;
  aiBridgeAvailable: boolean;
  aiEnabled: boolean;
  aiHealthy: boolean;
  aiBusy: boolean;
}>();

const emit = defineEmits<{
  'toggle-select': [];
  'start-backend-server': [];
}>();

const showAiStart = computed(
  () => props.aiBridgeAvailable && props.aiEnabled && !props.aiHealthy,
);
</script>

<style scoped>
.media-face-panel {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  pointer-events: auto;
}

.media-face-panel__ai-btn,
.media-face-panel__select-btn {
  width: 44px;
  min-width: 44px;
  height: 44px;
}

.media-face-panel__ai-btn {
  background: rgba(255, 255, 255, 0.16) !important;
  border: 2px solid rgba(255, 255, 255, 0.55);
}

.media-face-panel__ai-btn--ready {
  opacity: 0.95;
}

.media-face-panel__select-btn {
  background: rgba(255, 255, 255, 0.16) !important;
  border: 2px solid rgba(255, 255, 255, 0.55);
}

.media-face-panel__select-btn--active {
  background: rgba(255, 193, 7, 0.92) !important;
  border-color: #ffca28;
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.35);
}
</style>
