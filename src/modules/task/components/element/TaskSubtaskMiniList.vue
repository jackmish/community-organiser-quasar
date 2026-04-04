<template>
  <ul v-if="undoneLines.length > 0" class="subtask-mini-list" aria-label="Pending subtasks">
    <li
      v-for="line in undoneLines"
      :key="line.raw"
      class="subtask-mini-item"
      :title="line.text"
    >
      <q-icon name="radio_button_unchecked" size="10px" class="subtask-mini-icon" />
      <span class="subtask-mini-text">{{ line.text }}</span>
    </li>
  </ul>
</template>

<script setup lang="ts">
defineOptions({ name: "TaskSubtaskMiniList" });
import { computed } from "vue";

const props = defineProps<{
  /** Raw task object – only the `description` field is read. */
  task: any;
  /** Maximum number of unchecked items to show (default: 5). */
  maxItems?: number;
}>();

const DASH_RE = /^(\s*-\s*)(\[[xX]\]\s*)?(.*)$/;
const NUM_RE = /^(\s*\d+[.)]\s*)(\[[xX]\]\s*)?(.*)$/;

/** Parse the task description and return only unchecked list-item lines. */
const undoneLines = computed(() => {
  const desc = props.task?.description ?? "";
  if (!desc) return [];
  const max = props.maxItems ?? 5;
  const lines = (desc as string).split(/\r?\n/);
  const result: { raw: string; text: string }[] = [];

  for (const ln of lines) {
    if (result.length >= max) break;

    const dm = ln.match(DASH_RE);
    if (dm) {
      const marker = dm[2] ?? "";
      const checked = /^\s*\[[xX]\]\s*/.test(marker);
      if (!checked) {
        const text = (dm[3] ?? "").replace(/\s*\*\s*$/, "").trim();
        if (text) result.push({ raw: ln, text });
      }
      continue;
    }

    const nm = ln.match(NUM_RE);
    if (nm) {
      const marker = nm[2] ?? "";
      const checked = /^\s*\[[xX]\]\s*/.test(marker);
      if (!checked) {
        const text = (nm[3] ?? "").replace(/\s*\*\s*$/, "").trim();
        if (text) result.push({ raw: ln, text });
      }
    }
  }

  return result;
});
</script>

<style scoped>
.subtask-mini-list {
  list-style: none;
  margin: 4px 0 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.subtask-mini-item {
  display: flex;
  align-items: baseline;
  gap: 4px;
  font-size: 11px;
  color: rgba(0, 0, 0, 0.62);
  line-height: 1.3;
  overflow: hidden;
}

.subtask-mini-icon {
  flex-shrink: 0;
  opacity: 0.55;
  position: relative;
  top: 1px;
}

.subtask-mini-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
