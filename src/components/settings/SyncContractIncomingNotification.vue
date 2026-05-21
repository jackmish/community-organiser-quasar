<template>
  <div v-if="show" class="sync-incoming-notice-icon">
    <q-btn
      flat
      dense
      class="sync-incoming-notice-icon__btn"
      :aria-label="bannerText"
      @click="menuOpen = true"
    >
      <q-icon name="sync" size="20px" color="white" />
    </q-btn>

    <q-menu
      v-model="menuOpen"
      anchor="bottom left"
      self="top left"
      :offset="[0, 8]"
      class="sync-incoming-notice-menu"
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
            flat
            dense
            :label="$text('action.close')"
            @click="menuOpen = false"
          />
          <q-btn
            unelevated
            color="positive"
            :label="$text('sync.incoming_review_btn')"
            @click="onReview"
          />
        </q-card-actions>
      </q-card>
    </q-menu>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { $text } from 'src/modules/lang';

const props = defineProps<{
  show: boolean;
  proposerName: string;
}>();

const emit = defineEmits<{
  (e: 'review'): void;
}>();

const menuOpen = ref(false);

const bannerText = computed(() => {
  const raw = $text('sync.incoming_banner');
  return raw.replace('{device}', props.proposerName || '?');
});

function onReview(): void {
  menuOpen.value = false;
  emit('review');
}
</script>

<style scoped>
.sync-incoming-notice-icon {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
}

.sync-incoming-notice-icon__btn {
  width: 36px;
  height: 36px;
  min-width: 36px;
  min-height: 36px;
  padding: 0;
  border-radius: 6px;
  background: #21ba45 !important;
  color: #fff !important;
}

.sync-incoming-notice-icon__btn :deep(.q-btn__content),
.sync-incoming-notice-icon__btn :deep(.q-icon) {
  color: #fff !important;
}

.sync-incoming-notice-icon__btn:hover {
  filter: brightness(1.08);
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
