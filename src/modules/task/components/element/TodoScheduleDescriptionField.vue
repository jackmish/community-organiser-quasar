<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue';
import { $text } from 'src/modules/lang';

const model = defineModel<string>({ default: '' });

const expanded = ref(false);
const textareaRef = ref<HTMLTextAreaElement | null>(null);

const COLLAPSED_HEIGHT = 40;

function adjustHeight() {
  const ta = textareaRef.value;
  if (!ta) return;
  ta.style.height = 'auto';
  const max = expanded.value ? 200 : COLLAPSED_HEIGHT;
  ta.style.height = `${Math.min(max, Math.max(COLLAPSED_HEIGHT, ta.scrollHeight))}px`;
}

function onFocus() {
  expanded.value = true;
  void nextTick(() => adjustHeight());
}

function onBlur() {
  window.setTimeout(() => {
    expanded.value = false;
    void nextTick(() => adjustHeight());
  }, 120);
}

watch(model, () => {
  void nextTick(() => adjustHeight());
});

onMounted(() => {
  adjustHeight();
});
</script>

<template>
  <div
    class="todo-schedule-desc-field"
    :class="{ 'todo-schedule-desc-field--expanded': expanded }"
  >
    <textarea
      ref="textareaRef"
      v-model="model"
      class="todo-schedule-desc-field__input"
      :placeholder="$text('task.todo.schedule_description_placeholder')"
      rows="1"
      @focus="onFocus"
      @blur="onBlur"
      @input="adjustHeight"
    />
  </div>
</template>

<style scoped lang="scss">
.todo-schedule-desc-field {
  position: relative;
  flex: 0 0 auto;
  width: min(160px, 28vw);
  height: 40px;
  align-self: flex-end;
}

.todo-schedule-desc-field__input {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  min-height: 40px;
  max-height: 40px;
  margin: 0;
  padding: 8px 10px;
  box-sizing: border-box;
  border: 1px solid rgba(0, 0, 0, 0.24);
  border-radius: 4px;
  font-size: 14px;
  line-height: 1.25;
  font-family: inherit;
  color: rgba(0, 0, 0, 0.87);
  background: #e3f2fd;
  resize: none;
  overflow: hidden;
  outline: none;
  transition:
    box-shadow 0.15s ease,
    border-color 0.15s ease,
    max-height 0.15s ease;

  &::placeholder {
    color: rgba(0, 0, 0, 0.45);
  }

  &:focus {
    border-color: #1976d2;
    box-shadow: 0 0 0 1px #1976d2;
  }
}

.todo-schedule-desc-field--expanded {
  z-index: 20;

  .todo-schedule-desc-field__input {
    max-height: 200px;
    overflow-y: auto;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
  }
}
</style>
