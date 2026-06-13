<template>
  <div
    :class="[{ 'done-item': true, 'done-item--has-bg': hasBg(task) }]"
    :style="getDoneItemStyle(task)"
    @click="emit('select', task)"
  >
    <div class="row items-center justify-between" style="gap: 8px">
      <div class="row items-center" style="gap: 8px; min-width: 0">
        <q-icon :name="getIcon(task)" :style="{ color: getIconColor(task) }" />
        <div
          class="done-item__name"
          :class="{
            'text-strike': Number(task.status_id) === 0 && task.timeMode !== 'prepare',
          }"
          :style="{ color: getTextColor(task) }"
        >
          {{ getDisplayName(task) }}
        </div>
      </div>
      <div class="row items-center" style="gap: 8px; flex-shrink: 0">
        <div
          class="priority-indicator"
          :style="{
            backgroundColor: priorityColor(task.priority),
            borderColor: priorityColor(task.priority),
          }"
        />
        <q-icon name="done" size="18px" :style="{ color: getIconColor(task) }" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  priorityColors as themePriorityColors,
  priorityTextColor as themePriorityTextColor,
  findReplenishSet,
  typeIcons,
} from "src/components/theme";
import { getCycleType } from "src/modules/task/utils/occursOnDay";

const props = defineProps<{
  task: any;
}>();

const emit = defineEmits<{
  (e: "select", task: any): void;
}>();

const priorityColor = (priority: any) => themePriorityColors[priority] || "transparent";
const priorityTextColor = (priority: any) => themePriorityTextColor(priority);

const isCyclic = (t: any) => {
  try {
    return Boolean(getCycleType(t)) || Boolean(t && t.__isCyclicInstance);
  } catch {
    return Boolean(t && t.__isCyclicInstance);
  }
};

const getIcon = (t: any) => {
  if (!t) return "task";
  try {
    const type = t.type_id || t.type || "";
    if (type && typeIcons[type]) return typeIcons[type];
  } catch {
    // ignore
  }
  if (isCyclic(t)) return "repeat";
  if (t.eventTime) return "event";
  return "label";
};

const getDisplayName = (t: any) => {
  if (!t) return "";
  const name = t.name || "";
  try {
    if (Number(t.status_id) === 0 && t.timeMode === "prepare") {
      return `${name} [prepared]`;
    }
  } catch {
    // ignore
  }
  return name;
};

const hasBg = (t: any) => {
  if (!t) return false;
  if (t.type_id === "Replenish") {
    return !!findReplenishSet(t.color_set);
  }
  if (t.type_id !== "Replenish") {
    const bg = priorityColor(t.priority) || "";
    return !!bg && bg !== "transparent";
  }
  if (isCyclic(t)) {
    const bg = priorityColor(t.priority) || "";
    return !!bg && bg !== "transparent";
  }
  return false;
};

const getContrastColor = (hex: string) => {
  if (!hex) return "#000000";
  const h = hex.replace("#", "");
  const bigint = parseInt(
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h,
    16,
  );
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  const lum = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
  return lum > 0.6 ? "#000000" : "#ffffff";
};

const getIconColor = (t: any) => {
  if (!t) return "grey-6";
  if (t.type_id === "Replenish") {
    const s = findReplenishSet(t.color_set);
    return s ? s.text : "#000000";
  }
  if (hasBg(t)) return priorityTextColor(t.priority) || "#000000";
  return priorityColor(t.priority) || "rgba(0,0,0,0.87)";
};

const getTextColor = (t: any) => {
  if (!t) return "rgba(0,0,0,0.87)";
  if (t.type_id === "Replenish") {
    const s = findReplenishSet(t.color_set);
    return s ? s.text : "rgba(0,0,0,0.87)";
  }
  if (hasBg(t)) {
    return (
      priorityTextColor(t.priority) ||
      (priorityColor(t.priority)
        ? getContrastColor(priorityColor(t.priority))
        : "rgba(0,0,0,0.87)")
    );
  }
  return priorityTextColor(t.priority) || "rgba(0,0,0,0.87)";
};

const getDoneItemStyle = (t: any) => {
  if (!t) return {};
  if (t.type_id === "Replenish") {
    const s = findReplenishSet(t.color_set);
    if (s) return { backgroundColor: s.bg, color: s.text };
  }
  if (t.type_id !== "Replenish") {
    const bg = priorityColor(t.priority) || "transparent";
    const text = priorityTextColor(t.priority) || getContrastColor(bg);
    return { backgroundColor: bg, color: text };
  }
  try {
    if (isCyclic(t)) {
      const bg = priorityColor(t.priority) || "transparent";
      return { backgroundColor: bg, color: getContrastColor(bg) };
    }
  } catch {
    // ignore
  }
  return {};
};
</script>

<style scoped>
.done-item {
  filter: grayscale(10%);
  background: transparent;
  border-radius: 6px;
  padding: 6px 8px;
  width: 100%;
  cursor: pointer;
}

.done-item--has-bg {
  filter: none;
}

.done-item__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.priority-indicator {
  width: 14px;
  height: 14px;
  min-width: 14px;
  border-radius: 50%;
  border: 1px solid transparent;
}
</style>
