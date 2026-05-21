<template>
  <q-btn
    v-if="show"
    flat
    dense
    no-caps
    class="sync-incoming-notice-btn co21-glow-positive co21-glow-positive--pulse"
    :aria-label="bannerText"
  >
    <span class="sync-incoming-notice-btn__icons">
      <q-icon name="sync" size="14px" />
      <q-icon name="devices" size="14px" />
    </span>

    <q-popup-proxy
      anchor="bottom left"
      self="top left"
      :offset="[0, 6]"
      transition-show="scale"
      transition-hide="scale"
    >
      <q-card class="sync-incoming-notice-panel">
        <q-card-section class="q-pb-sm">
          <div class="text-subtitle2 text-weight-medium">
            {{ $text('sync.incoming_notice_title') }}
          </div>
        </q-card-section>
        <q-card-section class="q-pt-none q-pb-sm">
          <div class="text-body2 sync-incoming-notice-panel__body">{{ bannerText }}</div>
        </q-card-section>
        <q-card-actions align="right" class="q-pt-none">
          <q-btn
            unelevated
            color="positive"
            :label="$text('sync.incoming_review_btn')"
            @click="onReview"
          />
        </q-card-actions>
      </q-card>
    </q-popup-proxy>
  </q-btn>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { $text } from 'src/modules/lang';

const props = defineProps<{
  show: boolean;
  proposerName: string;
}>();

const emit = defineEmits<{
  (e: 'review'): void;
}>();

const bannerText = computed(() => {
  const raw = $text('sync.incoming_banner');
  return raw.replace('{device}', props.proposerName || '?');
});

function onReview(): void {
  emit('review');
}
</script>

<style scoped>
.sync-incoming-notice-btn {
  padding: 6px 8px;
  min-height: 32px;
  height: 32px;
  margin: 0;
  border-radius: 6px;
  background: #21ba45 !important;
  color: #fff !important;
}

.sync-incoming-notice-btn__icons {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.sync-incoming-notice-btn :deep(.q-btn__content),
.sync-incoming-notice-btn :deep(.q-icon) {
  color: #fff !important;
}

.sync-incoming-notice-panel {
  min-width: 280px;
  max-width: min(360px, 90vw);
  background: #fff;
  color: rgba(0, 0, 0, 0.87);
}

.sync-incoming-notice-panel__body {
  line-height: 1.45;
  word-break: break-word;
}
</style>
