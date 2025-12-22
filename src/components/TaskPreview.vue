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

            <div>
              <div v-for="(line, idx) in parsedLines" :key="idx">
                <div v-if="line.type === 'list'">
                  <q-item clickable class="q-pa-none" @click.stop="$emit('toggle-status', task, idx)">
                    <q-item-section side>
                      <q-icon :name="line.checked ? 'check_circle' : 'radio_button_unchecked'" :color="line.checked ? 'green' : 'grey-6'" />
                    </q-item-section>
                    <q-item-section>
                      <div v-html="line.html"></div>
                    </q-item-section>
                  </q-item>
                </div>
                <div v-else class="q-mb-xs" v-html="line.html"></div>
              </div>
            </div>

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
// - replace '[x]' with a check emoji
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
  escaped = escaped.replace(/\[x\]/gi, '✅');
  escaped = escaped.replace(/\n/g, '<br/>');
  return escaped;
});

// Parse description into lines and detect list lines (dash or numbered)
const isDone = computed(() => Number(props.task?.status_id) === 0);

const parsedLines = computed(() => {
  const d = props.task?.description || '';
  if (!d) return [] as Array<{ type: string; raw: string; html: string; checked?: boolean }>;
  const lines = d.split(/\r?\n/);
  return lines.map((ln) => {
    const dashMatch = ln.match(/^\s*-\s*(.*)$/);
    const numMatch = ln.match(/^\s*(\d+)[.)]\s*(.*)$/);
    if (dashMatch) {
      const content = dashMatch[1] || '';
      // detect [x] marker at start of the captured content and remove it from displayed text
      const markerMatch = content.match(/^\s*\[[xX]\]\s*/);
      const checked = !!markerMatch;
      const clean = content.replace(/^\s*\[[xX]\]\s*/, '');
      const html = escapeHtml(clean).replace(/\n/g, '<br/>');
      return { type: 'list', raw: ln, html, checked };
    }
    if (numMatch) {
      const idx = numMatch[1];
      const content = numMatch[2] || '';
      const markerMatch = content.match(/^\s*\[[xX]\]\s*/);
      const checked = !!markerMatch;
      const clean = content.replace(/^\s*\[[xX]\]\s*/, '');
      let html = escapeHtml(clean).replace(/\n/g, '<br/>');
      html = `${idx}. ${html}`;
      return { type: 'list', raw: ln, html, checked };
    }
    // regular text line
    const html = escapeHtml(ln).replace(/-vv/g, '✅').replace(/\n/g, '<br/>');
    return { type: 'text', raw: ln, html };
  });
});
</script>
