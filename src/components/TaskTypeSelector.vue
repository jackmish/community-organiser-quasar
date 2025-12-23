<template>
  <div class="row q-gutter-sm">
    <q-btn
      v-for="option in typeOptions"
      :key="option.value"
      :label="option.label"
      :icon="option.icon"
      size="md"
      :unelevated="modelValue === option.value"
      :outline="modelValue !== option.value"
      :color="modelValue === option.value ? 'primary' : 'grey-7'"
      @click="handleSelect(option.value)"
      no-caps
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const typeOptions = [
  { label: "Command center", value: "Command center", icon: "dashboard" },
  { label: "Replenish", value: "Replenish", icon: "autorenew" },
  { label: "Note/Later", value: "Note/Later", icon: "note" },
  { label: "TimeEvent", value: "TimeEvent", icon: "event" },
];

const isClickBlocked = ref(false);

function handleSelect(value: string) {
  if (props.modelValue !== value) {
    emit("update:modelValue", value);
  }
}
</script>
