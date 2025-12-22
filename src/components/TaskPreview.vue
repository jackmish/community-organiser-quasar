<template>
  <q-card class="q-mb-md">
    <q-card-section>
      <div class="row items-center justify-between">
        <div class="text-h6">Preview</div>
        <div>
          <q-btn flat dense label="Edit" color="primary" @click="$emit('edit')" />
          <q-btn flat dense label="Close" color="secondary" @click="$emit('close')" />
        </div>
      </div>
      <div class="q-mt-md">
        <div class="text-h5">{{ task.name }}</div>
        <div class="text-caption text-grey-7 q-mb-sm">{{ task.date }} {{ task.eventTime || '' }}</div>
        <div>{{ task.description }}</div>
        <div class="q-mt-md">
          <q-chip size="sm" :color="priorityColor(task.priority)" text-color="white">{{ task.priority }}</q-chip>
          <q-chip v-if="task.groupId" size="sm" icon="folder" class="q-ml-sm">{{ groupName }}</q-chip>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Task } from '../modules/day-organiser/types';

const props = defineProps<{ task: Task; groupName?: string }>();
const emit = defineEmits(['edit', 'close']);

const priorityColor = (p?: string) => {
  const colors: Record<string, string> = {
    low: 'cyan-3',
    medium: 'brown-7',
    high: 'orange',
    critical: 'negative',
  };
  return p ? colors[p] || 'grey-4' : 'grey-4';
};

const groupName = computed(() => props.groupName || '');
</script>
