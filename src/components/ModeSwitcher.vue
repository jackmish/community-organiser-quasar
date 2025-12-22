<template>
  <q-btn-toggle
    :model-value="modelValue"
    @update:model-value="(v) => emit('update:modelValue', v)"
    :options="[
      { label: 'Add new thing', value: 'add' },
      { label: 'Edit thing', value: 'edit' },
      { label: 'Preview', value: 'preview' }
    ]"
    size="sm"
    unelevated
  />
</template>

<script setup lang="ts">
import { toRef, watch } from 'vue';

const props = defineProps<{ modelValue?: string }>();
const emit = defineEmits(['update:modelValue']);

const modelValue = props.modelValue;
</script>
