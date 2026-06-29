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
      <q-icon name="precision_manufacturing" size="24px" color="white" />
      <span class="q-ml-sm">Off</span>
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

    <MediaRecognitionDetails
      v-if="recognitionAvailable"
      :rows="probeSummary"
      :total-samples="totalSampleCount"
      :engine="recognitionEngine || ''"
    />

    <q-btn
      v-if="recognitionAvailable"
      square
      unelevated
      class="media-face-panel__recognize-btn"
      :loading="recognitionBusy"
      :aria-label="$text('files.recognition_auto_detect')"
      :title="$text('files.recognition_auto_detect')"
      @click="emit('auto-recognize')"
    >
      <q-icon name="auto_awesome" size="24px" color="white" />
    </q-btn>

    <q-btn
      v-if="hasPending"
      square
      unelevated
      class="media-face-panel__pending-btn"
      :class="{ 'media-face-panel__pending-btn--active': showPending }"
      :aria-label="$text('files.recognition_toggle_pending')"
      :title="$text('files.recognition_toggle_pending')"
      @click="emit('toggle-pending')"
    >
      <q-icon name="preview" size="22px" :color="showPending ? 'grey-10' : 'white'" />
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
import MediaRecognitionDetails from './MediaRecognitionDetails.vue';
import type { RecognitionProbeSummary } from 'src/modules/recognition/recognitionModel';

const props = defineProps<{
  selectMode: boolean;
  aiBridgeAvailable: boolean;
  aiEnabled: boolean;
  aiHealthy: boolean;
  aiBusy: boolean;
  recognitionAvailable: boolean;
  recognitionBusy: boolean;
  hasPending: boolean;
  showPending: boolean;
  probeSummary: RecognitionProbeSummary[];
  totalSampleCount: number;
  recognitionEngine?: string;
}>();

const emit = defineEmits<{
  'toggle-select': [];
  'start-backend-server': [];
  'auto-recognize': [];
  'toggle-pending': [];
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

/* Remove fixed dimensions from AI button, keep them for icon-only buttons */
.media-face-panel__recognize-btn,
.media-face-panel__pending-btn,
.media-face-panel__select-btn {
  width: 44px;
  min-width: 44px;
  height: 44px;
}

.media-face-panel__ai-btn {
  background: rgba(255, 255, 255, 0.16) !important;
  border: 2px solid rgba(255, 255, 255, 0.55);
  padding: 8px 14px;
  min-height: 36px;
}

.media-face-panel__ai-btn .q-icon {
  margin-right: 6px;
}

.media-face-panel__ai-btn {
  background: rgba(255, 255, 255, 0.16) !important;
  border: 2px solid rgba(255, 255, 255, 0.55);
}

.media-face-panel__ai-btn--ready {
  opacity: 0.95;
}

.media-face-panel__recognize-btn {
  background: rgba(156, 39, 176, 0.55) !important;
  border: 2px solid rgba(225, 190, 231, 0.85);
}

.media-face-panel__pending-btn {
  background: rgba(255, 255, 255, 0.16) !important;
  border: 2px solid rgba(186, 104, 255, 0.85);
}

.media-face-panel__pending-btn--active {
  background: rgba(186, 104, 255, 0.92) !important;
  border-color: #ce93d8;
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
