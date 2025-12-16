<template>
  <div class="row q-gutter-sm">
    <q-btn
      v-for="option in typeOptions"
      :key="option.value"
      :label="option.label"
      :icon="option.icon"
      :unelevated="modelValue === option.value"
      :outline="modelValue !== option.value"
      :color="modelValue === option.value ? 'primary' : 'grey-7'"
      @click="handleSelect(option.value)"
      no-caps
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const typeOptions = [
  { label: "Command center", value: "Command center", icon: "dashboard" },
  { label: "Note/Later", value: "Note/Later", icon: "note" },
  { label: "TimeEvent", value: "TimeEvent", icon: "event" },
  { label: "Replenishment", value: "Replenishment", icon: "shopping_cart" },
];

const isClickBlocked = ref(false);

function handleSelect(value: string) {
  if (isClickBlocked.value) return;

  if (props.modelValue !== value) {
    isClickBlocked.value = true;
    emit('update:modelValue', value);

    // Unblock after a short delay
    setTimeout(() => {
      isClickBlocked.value = false;
    }, 150);
  }
}
</script>
