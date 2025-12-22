<template>
  <q-card class="q-mb-md">
    <q-card-section>
      <div class="row items-center justify-between">
        <div class="text-h6">Preview</div>
        <div>
          <q-btn flat dense label="Edit" color="primary" @click="$emit('edit')" />
          <q-btn flat dense label="Close" color="secondary" @click="$emit('close')" />
        </div>
      </div>
          <div class="q-mt-md">
            <div class="text-h5">{{ task.name }}</div>
            <div class="text-caption text-grey-7 q-mb-sm">{{ task.date }} {{ task.eventTime || '' }}</div>

            <div v-if="isListItem" class="row items-start">
              <q-btn
                dense
                flat
                round
                :icon="isDone ? 'check_circle' : 'radio_button_unchecked'"
                :color="isDone ? 'green' : 'grey-6'"
                @click="$emit('toggle-status', task)"
              />
              <div class="q-ml-sm" v-html="renderedListText"></div>
            </div>

            <div v-else v-html="renderedDescription"></div>

            <div class="q-mt-md">
              <q-chip size="sm" :color="priorityColor(task.priority)" text-color="white">{{ task.priority }}</q-chip>
              <q-chip v-if="task.groupId" size="sm" icon="folder" class="q-ml-sm">{{ groupName }}</q-chip>
            </div>
          </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Task } from '../modules/day-organiser/types';

const props = defineProps<{ task: Task; groupName?: string }>();
const emit = defineEmits(['edit', 'close', 'toggle-status']);

const priorityColor = (p?: string) => {
  const colors: Record<string, string> = {
    low: 'cyan-3',
    medium: 'brown-7',
    high: 'orange',
    critical: 'negative',
  };
  return p ? colors[p] || 'grey-4' : 'grey-4';
};

const groupName = computed(() => props.groupName || '');

// Rendered description with simple replacements:
// - replace '-vv' with a check emoji
// - escape HTML, then convert newlines to <br>
function escapeHtml(s = '') {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const renderedDescription = computed(() => {
  const d = props.task?.description || '';
  let escaped = escapeHtml(d);
  escaped = escaped.replace(/-vv/g, '✅');
  escaped = escaped.replace(/\n/g, '<br/>');
  return escaped;
});

// Detect leading numbered list item, e.g. "1. text" or "1) text"
const listItemMatch = computed(() => {
  const d = props.task?.description || '';
  const m = d.match(/^\s*(\d+)[.)]\s+(.*)$/s);
  return m ? { index: m[1], text: m[2] } : null;
});

const isListItem = computed(() => !!listItemMatch.value);
const isDone = computed(() => Number(props.task?.status_id) === 0);

const renderedListText = computed(() => {
  if (!listItemMatch.value) return '';
  const txt = listItemMatch.value.text || '';
  let escaped = escapeHtml(txt);
  escaped = escaped.replace(/-vv/g, '✅');
  escaped = escaped.replace(/\n/g, '<br/>');
  // prepend the numeric marker (with dot) for clarity
  return `${listItemMatch.value.index}. ${escaped}`;
});
</script>
