<template>
  <div
    class="co21-sync-banner rounded-borders"
    :class="{ 'co21-sync-banner--mobile': mobile }"
    role="status"
  >
    <q-icon :name="icon" class="co21-sync-banner__icon" color="white" />
    <p class="co21-sync-banner__text">{{ message }}</p>
    <q-btn
      class="co21-sync-banner__btn"
      unelevated
      dense
      color="white"
      text-color="positive"
      :label="buttonLabel"
      @click="emit('action')"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  icon: string;
  message: string;
  buttonLabel: string;
  mobile?: boolean;
}>();

const emit = defineEmits<{
  (e: 'action'): void;
}>();
</script>
