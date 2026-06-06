<template>
  <q-card-section class="media-files-panel">
    <div class="media-files-panel__placeholder">
      <q-icon name="folder_shared" size="48px" color="grey-6" />
      <div class="text-subtitle1 text-weight-medium q-mt-sm">
        {{ $text('files.panel_title') }}
      </div>
      <div class="text-caption text-grey-7 q-mt-xs">
        {{ $text('files.panel_placeholder') }}
      </div>
    </div>
  </q-card-section>
</template>

<script setup lang="ts">
import { $text } from 'src/modules/lang';
</script>

<style scoped>
.media-files-panel {
  min-height: 240px;
}

.media-files-panel__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  text-align: center;
  padding: 24px 16px;
}
</style>
