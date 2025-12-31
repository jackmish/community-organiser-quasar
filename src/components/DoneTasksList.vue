<template>
  <q-card flat class="q-pa-sm q-mb-md" style="background: transparent; border-radius: 8px">
    <div class="row items-center" style="gap: 8px">
      <q-icon name="check" color="grey-7" />
      <div class="text-subtitle2"><strong>Done</strong></div>
    </div>
    <div class="q-mt-sm">
      <div v-for="d in props.doneTasks" :key="d.id" class="done-item" @click="onDoneClick(d)">
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
  </q-card>
</template>

<script setup lang="ts">
const props = defineProps<{
  doneTasks: any[];
}>();

const emit = defineEmits<{
  (e: 'toggle-status', task: any): void;
}>();

function onDoneClick(task: any) {
  console.debug('[DoneTasksList] clicked', task && task.id);
  emit('toggle-status', task);
}
</script>

<style scoped>
.done-item {
  filter: grayscale(100%);
  opacity: 0.9;
  background: transparent;
  border-radius: 6px;
  padding: 6px 8px;
  margin-bottom: 6px;
}
</style>
