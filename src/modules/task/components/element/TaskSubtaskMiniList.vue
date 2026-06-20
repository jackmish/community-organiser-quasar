<template>
  <ul
    v-if="undoneLines.length > 0"
    :class="variant === 'chip' ? 'subtask-chip-list' : 'subtask-mini-list'"
    aria-label="Pending subtasks"
  >
    <li
      v-for="line in undoneLines"
      :key="line.raw"
      :class="variant === 'chip' ? 'subtask-chip' : 'subtask-mini-item'"
      :title="line.text"
    >
      <q-icon
        v-if="variant !== 'chip'"
        name="radio_button_unchecked"
        size="10px"
        class="subtask-mini-icon"
      />
      <span :class="variant === 'chip' ? 'subtask-chip-text' : 'subtask-mini-text'">{{
        line.text
      }}</span>
    </li>
  </ul>
</template>

<script setup lang="ts">
defineOptions({ name: 'TaskSubtaskMiniList' });
import { computed } from 'vue';
import { parseUndoneSubtasks } from 'src/modules/task/utils/todo';

const props = withDefaults(
  defineProps<{
    /** Raw task object – only the `description` field is read. */
    task: any;
    /** Maximum unchecked items to show; omit to show all. */
    maxItems?: number;
    /** `chip` = menu-like pills in a wrapping row; `mini` = compact dashed list. */
    variant?: 'mini' | 'chip';
  }>(),
  {
    variant: 'mini',
  },
);

const undoneLines = computed(() =>
  parseUndoneSubtasks(props.task?.description ?? '', props.maxItems),
);
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
  align-items: flex-start;
  gap: 4px;
  font-size: 11px;
  color: rgba(0, 0, 0, 0.62);
  line-height: 1.3;
}

.subtask-mini-icon {
  flex-shrink: 0;
  opacity: 0.55;
  position: relative;
  top: 2px;
}

.subtask-mini-text {
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.subtask-chip-list {
  list-style: none;
  margin: 6px 0 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 6px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.subtask-chip {
  display: inline-flex;
  align-items: flex-start;
  max-width: 100%;
  min-width: 0;
  min-height: 30px;
  padding: 5px 11px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(0, 0, 0, 0.14);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
  color: rgba(0, 0, 0, 0.88);
  cursor: pointer;
  pointer-events: none;
  user-select: none;
}

.subtask-chip-text {
  display: block;
  min-width: 0;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}
</style>
