<template>
  <q-card flat class="q-pa-sm q-mb-md" style="background: #e8f5ff; border-radius: 8px">
    <div class="row items-center" style="gap: 8px">
      <q-icon name="shopping_cart" color="primary" />
      <div class="text-subtitle2 text-primary"><strong>Replenishment</strong></div>
    </div>
    <div class="replenish-grid q-mt-sm">
      <div
        v-for="r in replenishTasks"
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
    <q-separator class="q-mt-sm" />
    <div class="q-mt-sm">
      <div class="row items-center" style="gap: 8px">
        <q-icon name="check" color="grey-7" />
        <div class="text-subtitle2"><strong>Done</strong></div>
      </div>
      <div class="q-mt-sm">
        <div v-for="d in doneTasks" :key="d.id" class="done-item" @click="onDoneClick(d)">
          <div class="row items-center justify-between" style="gap: 8px">
            <div
              :class="{ 'text-strike': Number(d.status_id) === 0 }"
              style="color: rgba(0, 0, 0, 0.45)"
            >
              {{ d.name }}
            </div>
            <q-icon name="done" size="18px" color="grey-6" />
          </div>
        </div>
      </div>
    </div>
  </q-card>
</template>

<script setup lang="ts">
import { useLongPress } from '../composables/useLongPress';

const props = defineProps<{
  replenishTasks: any[];
  doneTasks: any[];
}>();

const emit = defineEmits<{
  (e: 'toggle-status', task: any): void;
  (e: 'edit-task', task: any): void;
  (e: 'replenish-restore', taskId: string): void;
}>();

// Local color sets so component can compute bg/text
const replenishColorSets = [
  { id: 'set-1', bg: '#b71c1c', text: '#ffffff' },
  { id: 'set-4', bg: '#ff5252', text: '#000000' },
  { id: 'set-3', bg: '#ff8a80', text: '#000000' },
  { id: 'set-5', bg: '#fdd835', text: '#000000' },
  { id: 'set-8', bg: '#ffeb3b', text: '#000000' },
  { id: 'set-6', bg: '#fff176', text: '#000000' },
  { id: 'set-9', bg: '#2e7d32', text: '#ffffff' },
  { id: 'set-11', bg: '#9ccc65', text: '#000000' },
  { id: 'set-12', bg: '#a5d6a7', text: '#000000' },
  { id: 'set-13', bg: '#00acc1', text: '#ffffff' },
  { id: 'set-15', bg: '#80deea', text: '#000000' },
  { id: 'set-16', bg: '#b2ebf2', text: '#000000' },
  { id: 'set-17', bg: '#0d47a1', text: '#ffffff' },
  { id: 'set-18', bg: '#1976d2', text: '#ffffff' },
  { id: 'set-20', bg: '#90caf9', text: '#000000' },
  { id: 'set-21', bg: '#6a1b9a', text: '#ffffff' },
  { id: 'set-23', bg: '#ab47bc', text: '#ffffff' },
  { id: 'set-24', bg: '#ce93d8', text: '#000000' },
  { id: 'set-25', bg: '#000000', text: '#ffffff' },
  { id: 'set-27', bg: '#9e9e9e', text: '#000000' },
  { id: 'set-28', bg: '#ffffff', text: '#000000' },
];

const findColorSet = (id?: string | null) => {
  if (!id) return null;
  return replenishColorSets.find((s) => s.id === id) || null;
};

const getReplenishBg = (task: any) => {
  const s = findColorSet(task.color_set);
  return s ? s.bg : 'transparent';
};

const getReplenishText = (task: any) => {
  const s = findColorSet(task.color_set);
  return s ? s.text : 'inherit';
};

// Use local long-press to emit edit requests
const { startLongPress, cancelLongPress, setLongPressHandler } = useLongPress();
setLongPressHandler((t: any) => emit('edit-task', t));

const replenishTasks = props.replenishTasks || [];
const doneTasks = props.doneTasks || [];

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
