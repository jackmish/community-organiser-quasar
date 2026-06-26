<template>
  <q-btn
    square
    unelevated
    class="media-recognition-details__btn"
    :aria-label="$text('files.recognition_details')"
    :title="$text('files.recognition_details')"
  >
    <q-icon name="info" size="22px" color="white" />
    <q-menu anchor="bottom left" self="top left" class="media-recognition-details__menu">
      <div class="media-recognition-details__panel">
        <div class="media-recognition-details__title">{{ $text('files.recognition_details') }}</div>
        <div v-if="engine" class="media-recognition-details__engine">{{ engine }}</div>
        <div v-if="!rows.length" class="media-recognition-details__empty">
          {{ $text('files.recognition_details_empty') }}
        </div>
        <ul v-else class="media-recognition-details__list">
          <li v-for="row in rows" :key="row.label" class="media-recognition-details__item">
            <span class="media-recognition-details__label">{{ row.label }}</span>
            <span class="media-recognition-details__meta">
              {{ fmt('files.recognition_details_samples', { count: row.sampleCount }) }}
              ·
              {{ fmt('files.recognition_details_photos', { count: row.photoCount }) }}
            </span>
          </li>
        </ul>
        <div v-if="rows.length" class="media-recognition-details__total">
          {{ fmt('files.recognition_details_total', { samples: totalSamples, characters: rows.length }) }}
        </div>
      </div>
    </q-menu>
  </q-btn>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { $text } from 'src/modules/lang';
import type { RecognitionProbeSummary } from 'src/modules/recognition/recognitionModel';

const props = defineProps<{
  rows: RecognitionProbeSummary[];
  totalSamples: number;
  engine?: string;
}>();

const engine = computed(() => String(props.engine || '').trim());

function fmt(key: string, vars: Record<string, string | number>): string {
  let out = $text(key);
  for (const [name, value] of Object.entries(vars)) {
    out = out.replace(`{${name}}`, String(value));
  }
  return out;
}
</script>

<style scoped>
.media-recognition-details__btn {
  width: 44px;
  min-width: 44px;
  height: 44px;
  background: rgba(255, 255, 255, 0.16) !important;
  border: 2px solid rgba(144, 202, 249, 0.85);
}

.media-recognition-details__panel {
  min-width: 240px;
  max-width: 360px;
  padding: 12px 14px;
  color: #111827;
}

.media-recognition-details__title {
  font-weight: 700;
  font-size: 13px;
  margin-bottom: 6px;
}

.media-recognition-details__engine {
  font-size: 11px;
  color: #4b5563;
  margin-bottom: 8px;
  word-break: break-word;
}

.media-recognition-details__empty {
  font-size: 12px;
  color: #6b7280;
}

.media-recognition-details__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.media-recognition-details__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 0;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.media-recognition-details__item:first-child {
  border-top: none;
  padding-top: 0;
}

.media-recognition-details__label {
  font-weight: 600;
  font-size: 12px;
}

.media-recognition-details__meta {
  font-size: 11px;
  color: #4b5563;
}

.media-recognition-details__total {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  font-size: 11px;
  color: #374151;
}
</style>
