<template>
  <div class="co21-app-background" aria-hidden="true">
    <div
      class="co21-app-background__layer"
      :class="{ 'co21-app-background__layer--visible': visibleSlot === 0 }"
    >
      <div class="co21-app-background__photo" :style="layer0.photo" />
      <div
        v-if="layer0.wash"
        class="co21-app-background__wash"
        :style="layer0.wash"
      />
    </div>
    <div
      class="co21-app-background__layer"
      :class="{ 'co21-app-background__layer--visible': visibleSlot === 1 }"
    >
      <div class="co21-app-background__photo" :style="layer1.photo" />
      <div
        v-if="layer1.wash"
        class="co21-app-background__wash"
        :style="layer1.wash"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GroupBackgroundLayerBundle } from 'src/modules/group/utils/groupBackground';

defineProps<{
  visibleSlot: 0 | 1;
  layer0: GroupBackgroundLayerBundle;
  layer1: GroupBackgroundLayerBundle;
}>();
</script>

<style scoped lang="scss">
.co21-app-background {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.co21-app-background__layer {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.55s ease;
  will-change: opacity;
}

.co21-app-background__layer--visible {
  opacity: 1;
}

.co21-app-background__photo,
.co21-app-background__wash {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center center;
  background-repeat: no-repeat;
  background-attachment: fixed;
}

.co21-app-background__wash {
  pointer-events: none;
}
</style>
