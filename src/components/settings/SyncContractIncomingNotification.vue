<template>
  <div
    v-if="show"
    class="sync-incoming-notice q-ml-sm"
    role="button"
    tabindex="0"
    @click="emit('review')"
    @keydown.enter="emit('review')"
  >
    <q-icon name="sync" size="16px" />
    <span class="sync-incoming-notice__text">{{ bannerText }}</span>
    <q-btn
      dense
      unelevated
      size="sm"
      color="white"
      text-color="positive"
      class="q-ml-xs"
      :label="$text('sync.incoming_review_btn')"
      @click.stop="emit('review')"
    />
  </div>
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
</script>

<style scoped>
.sync-incoming-notice {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 6px;
  background-color: #21ba45;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  line-height: 1.3;
  max-width: min(420px, 42vw);
  flex-shrink: 0;
  min-width: 0;
}

.sync-incoming-notice__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
</style>
