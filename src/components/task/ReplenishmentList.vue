<template>
  <q-card
    flat
    :class="['q-pa-sm q-mb-md', size === 'small' ? 'replenish-small' : 'replenish-default']"
    :style="containerStyle"
  >
    <!-- <div class="row items-center" style="gap: 8px">
      <q-icon name="shopping_cart" color="primary" />
      <div class="text-subtitle2 text-primary"><strong>Replenishment</strong></div>
    </div> -->
    <div class="replenish-grid">
      <div
        v-for="r in props.replenishTasks"
        :key="r.id"
        class="replenish-item card q-pa-sm"
        role="button"
        @pointerdown="() => startLongPress(r)"
        @pointerup="cancelLongPress"
        @pointercancel="cancelLongPress"
        @pointerleave="cancelLongPress"
        @click="onReplenishClick(r)"
        :style="{ background: getReplenishBg(r) }"
      >
        <div class="row items-center justify-between" style="gap: 8px">
          <div
            :class="{ 'text-strike': Number(r.status_id) === 0 }"
            :style="{ color: getReplenishText(r) }"
          >
            {{ r.name }}
          </div>
        </div>
      </div>
    </div>
  </q-card>
</template>

<script setup lang="ts">
import { useLongPress } from 'src/composables/useLongPress';
import {
  findReplenishSet,
  getReplenishBg as themeGetReplenishBg,
  getReplenishText as themeGetReplenishText,
} from '../theme';

const props = defineProps<{
  replenishTasks: any[];
  size?: 'default' | 'small';
}>();

const size = props.size || 'default';

import { computed } from 'vue';

// Compute a container style so the whole ReplenishmentList card can span
// multiple columns in the parent grid. For small mode: 1-3 items -> span 1,
// 4-6 -> span 2, 7-9 -> span 3, etc.
const containerStyle = computed(() => {
  const base: any = { background: 'transparent', borderRadius: '8px' };
  if (size !== 'small') return base;
  const n = Array.isArray(props.replenishTasks) ? props.replenishTasks.length : 0;
  const span = Math.max(1, Math.ceil(n / 3));
  // Set gridColumn to span N so the card consumes multiple columns in the parent's grid
  base.gridColumn = `span ${span}`;
  return base;
});

const emit = defineEmits<{
  (e: 'toggle-status', task: any): void;
  (e: 'edit-task', task: any): void;
  (e: 'replenish-restore', taskId: string): void;
}>();

// Use centralized replenish color helpers from theme
const getReplenishBg = (task: any) => themeGetReplenishBg(task.color_set);
const getReplenishText = (task: any) => themeGetReplenishText(task.color_set);

// Use local long-press to emit edit requests
const { startLongPress, cancelLongPress, setLongPressHandler } = useLongPress();
setLongPressHandler((t: any) => emit('edit-task', t));

function onReplenishClick(task: any) {
  emit('toggle-status', task);
}

function onDoneClick(task: any) {
  emit('toggle-status', task);
}
</script>

<style scoped>
.replenish-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.replenish-item {
  cursor: pointer;
  border-radius: 6px;
  background: #fff9;
  padding: 8px;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.done-item {
  filter: grayscale(100%);
  opacity: 0.9;
  background: transparent;
  border-radius: 6px;
  padding: 6px 8px;
  margin-bottom: 6px;
}

/* Small mode (compact) */
.replenish-small .replenish-grid {
  grid-template-columns: repeat(auto-fit, minmax(72px, 1fr));
  gap: 6px;
}
.replenish-small .replenish-item {
  padding: 4px;
  min-height: 22px;
  font-size: 11px;
  border-radius: 4px;
}
.replenish-small .replenish-item .text-body1 {
  font-size: 11px;
  line-height: 1;
}
.replenish-small q-icon {
  font-size: 14px;
}

/* Default mode keeps original spacing but provide a named class for clarity */
.replenish-default .replenish-grid {
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
</style>
