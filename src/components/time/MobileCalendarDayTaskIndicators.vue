<template>
  <div
    class="mobile-calendar-day-indicators"
    role="toolbar"
    :aria-label="ariaLabel"
  >
    <button
      v-for="item in items"
      :key="item.key"
      type="button"
      class="mobile-calendar-day-indicators__chip"
      :style="{
        backgroundColor: item.backgroundColor,
        color: item.color,
      }"
      :title="item.title"
      :aria-label="item.title"
      @click="emit('select', { taskId: item.taskId, eventTime: item.eventTime })"
    >
      <span class="mobile-calendar-day-indicators__label">{{ item.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { $text } from "src/modules/lang";

export type MobileCalendarDayTaskIndicatorItem = {
  key: string;
  taskId: string;
  eventTime: string | null;
  label: string;
  title: string;
  backgroundColor: string;
  color: string;
};

export type MobileCalendarDayTaskIndicatorSelectPayload = {
  taskId: string;
  eventTime: string | null;
};

const props = defineProps<{
  items: MobileCalendarDayTaskIndicatorItem[];
}>();

const emit = defineEmits<{
  select: [payload: MobileCalendarDayTaskIndicatorSelectPayload];
}>();

const ariaLabel = computed(() => {
  const count = props.items.length;
  if (count === 0) return "";
  return `${count} ${$text("ui.calendar_view")}`;
});
</script>

<style scoped src="../../css/mobile-calendar-day-indicators.scss"></style>
