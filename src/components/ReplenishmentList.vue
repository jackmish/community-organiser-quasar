<template>
  <q-card flat class="q-pa-sm q-mb-md" style="background: #e8f5ff; border-radius: 8px">
    <div class="row items-center" style="gap: 8px">
      <q-icon name="shopping_cart" color="primary" />
      <div class="text-subtitle2 text-primary"><strong>Replenishment</strong></div>
    </div>
    <div class="replenish-grid q-mt-sm">
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
import { useLongPress } from '../composables/useLongPress';
import {
  findReplenishSet,
  getReplenishBg as themeGetReplenishBg,
  getReplenishText as themeGetReplenishText,
} from './theme';

const props = defineProps<{
  replenishTasks: any[];
}>();

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
  margin-top: 8px;
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
</style>
