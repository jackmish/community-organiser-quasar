<template>
  <q-btn
    v-if="show"
    flat
    dense
    no-caps
    class="sync-revoked-notice-btn co21-glow-negative co21-glow-negative--pulse"
    :aria-label="bannerText"
    @click="emit('open')"
  >
    <span class="sync-revoked-notice-btn__icons">
      <q-icon name="sync_disabled" size="14px" />
      <q-icon name="devices" size="14px" />
    </span>
  </q-btn>
</template>

<script setup lang="ts">
defineProps<{
  show: boolean;
  bannerText: string;
}>();

const emit = defineEmits<{
  (e: 'open'): void;
}>();
</script>

<style scoped>
.sync-revoked-notice-btn {
  padding: 6px 8px;
  min-height: 32px;
  height: 32px;
  margin: 0;
  border-radius: 6px;
  background: #c10015 !important;
  color: #fff !important;
}

.sync-revoked-notice-btn__icons {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.sync-revoked-notice-btn :deep(.q-btn__content),
.sync-revoked-notice-btn :deep(.q-icon) {
  color: #fff !important;
}
</style>
