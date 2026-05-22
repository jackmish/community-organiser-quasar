<template>
  <div class="co21-app-background" aria-hidden="true">
      <div
        class="co21-app-background__layer"
        :class="{ 'co21-app-background__layer--visible': visibleSlot === 0 }"
        :style="layer0"
      />
      <div
        class="co21-app-background__layer"
        :class="{ 'co21-app-background__layer--visible': visibleSlot === 1 }"
        :style="layer1"
      />
    </div>
</template>

<script setup lang="ts">
defineProps<{
  visibleSlot: 0 | 1;
  layer0: Record<string, string>;
  layer1: Record<string, string>;
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
</style>
