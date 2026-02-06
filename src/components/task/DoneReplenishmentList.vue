<template>
  <DoneTasksList :done-tasks="doneTasks" @toggle-status="$emit('toggle-status', $event)" />
</template>

<script setup lang="ts">
import DoneTasksList from './DoneTasksList.vue';

const props = defineProps<{
  doneTasks: any[];
}>();

const emit = defineEmits<{
  (e: 'toggle-status', task: any): void;
}>();
</script>

<style scoped>
/* This file is a thin wrapper for backwards compatibility.
   Use DoneTasksList.vue going forward. */
</style>
