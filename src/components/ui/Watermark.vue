<template>
  <div v-if="label" class="co21-watermark" :title="label">
    <span class="co21-watermark-text">{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'Co21Watermark' });
import { computed } from 'vue';
import type { Ref } from 'vue';

const props = defineProps<{ activeGroup?: unknown; label?: string | Ref<string> }>();

const label = computed(() => {
  const explicit = (props as any).label;
  const explicitVal =
    explicit && typeof explicit === 'object' && 'value' in explicit ? explicit.value : explicit;
  if (explicitVal) return explicitVal || '';

  const ag = (props as any).activeGroup;
  // handle both Ref and plain object
  const val = ag && typeof ag === 'object' && 'value' in ag ? ag.value : ag;
  if (!val) return '';
  // prefer label, fallback to value or id
  return val.label ?? val.value ?? val.id ?? '';
});
</script>

<style scoped>
.co21-watermark {
  position: absolute;
  inset: 0; /* top:0; right:0; bottom:0; left:0 */
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  pointer-events: none; /* don't block interaction */
  z-index: 0; /* top layer but below modal overlays if needed */
  top: 0;
}

.co21-watermark-text {
  /* color: rgba(0, 0, 0, 1); */
  color: rgba(0, 255, 255, 1);
  font-weight: 700;
  text-transform: uppercase;
  white-space: nowrap;
  font-size: 8vw; /* subtle, scales with viewport */
  line-height: 1;
  user-select: none;
  transform: rotate(0deg);
  letter-spacing: 0.12em;
  text-align: center;
  mix-blend-mode: screen; /* subtly lighten dark backgrounds */
  opacity: 0.1;
  mix-blend-mode: multiply; /* subtly darken background where text overlaps */
}
</style>
