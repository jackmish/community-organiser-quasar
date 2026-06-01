<template>
  <div
    v-if="show"
    class="q-mt-sm quick-add-subtask"
    style="display: flex; gap: 8px; align-items: center"
  >
    <q-input
      ref="quickSubtaskInput"
      dense
      outlined
      type="textarea"
      autosize
      rows="1"
      :placeholder="$text('label.quick_add_subtask')"
      v-model="quickSubtask"
      @keydown.enter.prevent="submit"
      style="flex: 1; min-height: 40px"
    />
    <q-btn
      dense
      flat
      round
      size="sm"
      :icon="highlightIcon"
      :color="quickSubtaskStar ? 'amber' : undefined"
      @click.stop="quickSubtaskStar = !quickSubtaskStar"
      :title="quickSubtaskStar ? $text('label.pinned') : $text('action.pin')"
    />
    <q-btn
      dense
      unelevated
      color="positive"
      icon="add"
      @mousedown.prevent
      @click="submit"
    />
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'QuickAddSubtaskForm' });

import { ref, nextTick } from 'vue';
import { $text } from 'src/modules/lang';
import { highlightIcon } from 'src/components/theme';

withDefaults(
  defineProps<{
    /** When false, the form is hidden (parent still controls Todo / TimeEvent type). */
    show?: boolean;
  }>(),
  { show: true },
);

const emit = defineEmits<{
  add: [payload: { text: string; starred: boolean }];
}>();

const quickSubtask = ref('');
const quickSubtaskStar = ref(false);
const quickSubtaskInput = ref<{ focus?: () => void; $el?: HTMLElement } | null>(null);

function refocusInput() {
  nextTick(() => {
    try {
      const input = quickSubtaskInput.value;
      if (input && typeof input.focus === 'function') {
        input.focus();
        return;
      }
      const el = (input?.$el ?? input) as HTMLElement | undefined;
      const field = el?.querySelector?.('textarea, input') as HTMLTextAreaElement | null;
      field?.focus();
    } catch {
      // ignore
    }
  });
}

function submit() {
  const text = quickSubtask.value.trim();
  if (!text) return;
  emit('add', { text, starred: quickSubtaskStar.value });
  quickSubtask.value = '';
  quickSubtaskStar.value = false;
  refocusInput();
}
</script>
