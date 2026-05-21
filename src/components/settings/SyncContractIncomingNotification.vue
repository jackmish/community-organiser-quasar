<template>
  <q-btn
    v-if="show"
    flat
    dense
    no-caps
    class="sync-incoming-notice-btn co21-glow-positive co21-glow-positive--pulse"
    :aria-label="bannerText"
    @click="onReview"
  >
    <span class="sync-incoming-notice-btn__icons">
      <q-icon name="sync" size="14px" />
      <q-icon name="devices" size="14px" />
    </span>
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
</style>
