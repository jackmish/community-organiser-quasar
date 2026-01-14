<template>
  <q-card class="q-mb-md task-preview" :style="previewCardStyle">
    <q-card-section>
      <!-- header: title on left, copy on right -->
      <div class="row items-center justify-between q-mb-sm">
        <div class="text-h5">{{ task.name }}</div>
        <q-btn dense flat icon="content_copy" label="Copy" @click="copyStyledTask" />
      </div>
      <div>
        <div class="row items-baseline justify-between q-mb-sm preview-datetime-row">
          <div class="text-caption text-grey-7 preview-datetime">
            <span :class="['preview-date', { insignificant: !isTimeEvent }]">{{
              displayDate
            }}</span>
            <span v-if="task.eventTime" class="preview-time">{{ task.eventTime }}</span>
            <span v-if="eventTimeHoursDisplay" class="text-caption text-grey-6 q-ml-sm">{{
              eventTimeHoursDisplay
            }}</span>
          </div>
          <div style="display: flex; gap: 8px; align-items: center">
            <q-chip
              size="sm"
              :style="{
                backgroundColor: priorityColor(task.priority),
                color: priorityTextColor(task.priority),
              }"
              >{{ task.priority }}</q-chip
            >
            <q-chip v-if="task.groupId" size="sm" icon="folder" class="q-ml-sm">{{
              groupName
            }}</q-chip>
          </div>
        </div>

        <!-- quick add moved to top of description -->
        <div
          v-if="(task.type_id || '') === 'Todo'"
          class="q-mt-sm"
          style="display: flex; gap: 8px; align-items: center"
        >
          <q-input
            dense
            outlined
            placeholder="Quick add subtask"
            v-model="quickSubtask"
            @keyup.enter="addQuickSubtask"
            style="flex: 1"
          />
          <q-btn dense unelevated color="positive" icon="add" @click="addQuickSubtask" />
        </div>

        <div>
          <div v-for="(line, idx) in parsedLines" :key="idx">
            <div v-if="line.type === 'list'">
              <div
                class="collapse-wrapper"
                :ref="(el) => setItemRef(el, idx)"
                :class="{ shrinking: props.animatingLines && props.animatingLines.includes(idx) }"
              >
                <q-item clickable class="q-pa-none" @click.stop="$emit('toggle-status', task, idx)">
                  <q-item-section side>
                    <q-icon
                      :name="line.checked ? 'check_circle' : 'radio_button_unchecked'"
                      :color="line.checked ? 'green' : 'grey-6'"
                    />
                  </q-item-section>
                  <q-item-section>
                    <div v-html="line.html"></div>
                  </q-item-section>
                </q-item>
              </div>
            </div>
            <div v-else class="q-mb-xs" v-html="line.html"></div>
          </div>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed, toRaw, ref, nextTick, watch } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import logger from 'src/utils/logger';
import { format } from 'date-fns';
import {
  priorityColors,
  priorityTextColor,
  formatDisplayDate,
  formatEventHoursDiff,
  priorityDefinitions,
} from './theme';
import type { Task } from '../modules/day-organiser/types';

const props = defineProps<{ task: Task; groupName?: string; animatingLines?: number[] }>();
const emit = defineEmits(['edit', 'close', 'toggle-status', 'update-task']);

// Quick-add subtask helper
const quickSubtask = ref('');

// refs to each rendered list item so we can animate height directly
const itemRefs = ref<Array<HTMLElement | null>>([] as Array<HTMLElement | null>);

function setItemRef(el: Element | ComponentPublicInstance | null, idx: number) {
  if (!el) {
    itemRefs.value[idx] = null;
    return;
  }
  // If a raw HTMLElement was passed, use it. Otherwise, if a Vue component
  // instance was passed, prefer its $el root DOM node.
  if (el instanceof HTMLElement) {
    itemRefs.value[idx] = el;
    return;
  }
  const maybeEl = (el as any)?.$el;
  if (maybeEl && maybeEl instanceof HTMLElement) {
    itemRefs.value[idx] = maybeEl;
    return;
  }
  // fallback
  itemRefs.value[idx] = null;
}

// When parent requests an animating line, collapse that element by animating
// its explicit height/padding/margin to 0 so elements below move up naturally.
watch(
  () => props.animatingLines && [...(props.animatingLines || [])],
  async (newVal, oldVal) => {
    const added = (newVal || []).filter((i) => !(oldVal || []).includes(i));
    for (const idx of added) {
      const el = itemRefs.value[idx];
      if (!el) continue;
      try {
        const style = el.style;
        // capture current dimensions
        const startHeight = el.scrollHeight + 'px';
        style.overflow = 'hidden';
        style.height = startHeight;
        style.marginBottom = getComputedStyle(el).marginBottom;
        // force layout
        await nextTick();
        void el.offsetHeight;
        style.transition = 'height 0.5s ease-in-out, margin 0.5s ease-in-out';
        // animate to collapsed (height/margin only)
        style.height = '0px';
        style.marginBottom = '0px';

        const handler = (ev: TransitionEvent) => {
          if ((ev && ev.propertyName !== 'height') || !el) return;
          // cleanup inline styles after animation
          style.removeProperty('height');
          style.removeProperty('overflow');
          style.removeProperty('transition');
          style.removeProperty('padding-top');
          style.removeProperty('padding-bottom');
          style.removeProperty('margin-bottom');
          el.removeEventListener('transitionend', handler);
        };
        el.addEventListener('transitionend', handler);
      } catch (e) {
        // ignore animation errors
      }
    }
  },
);

function addQuickSubtask() {
  const text = (quickSubtask.value || '').trim();
  if (!text) return;
  const cur = props.task.description || '';
  // Insert new subtask after the first title line when the description begins with the title;
  // otherwise prepend at the top.
  const title = (props.task?.name || '').trim();
  const lines = cur.split(/\r?\n/);
  let updated: string;
  if (title && lines.length > 0) {
    const first = lines[0] || '';
    const titleMatch = new RegExp('^\\s*' + escapeRegExp(title) + '\\b', 'i');
    if (titleMatch.test(first)) {
      if (lines.length === 1) {
        updated = `${first}\n- ${text}`;
      } else {
        updated = `${first}\n- ${text}\n${lines.slice(1).join('\n')}`;
      }
    } else {
      updated = cur ? `- ${text}\n${cur}` : `- ${text}`;
    }
  } else {
    updated = cur ? `- ${text}\n${cur}` : `- ${text}`;
  }
  const newTask = { ...(toRaw(props.task) as any), description: updated } as Task;
  emit('update-task', newTask);
  quickSubtask.value = '';
  nextTick(() => {
    // no-op; parent will handle re-render
  });
}

// preview card style: 8px blue border to match AddTaskForm style
const previewCardStyle = computed(() => ({
  border: '8px solid #1976d2',
  backgroundColor: '#ffffff',
}));

const priorityColor = (p?: string) => {
  return p ? priorityColors[p] || 'grey-4' : 'grey-4';
};

const groupName = computed(() => props.groupName || '');

const isTimeEvent = computed(() => (props.task?.type_id || '') === 'TimeEvent');

// Rendered description with simple replacements:
// - replace '[x]' with a check emoji
// - escape HTML, then convert newlines to <br>
function escapeHtml(s = '') {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const renderedDescription = computed(() => {
  const d = props.task?.description || '';
  // If the description begins with the title, strip that prefix for preview clarity
  const stripped = stripTitleFrom(d, props.task?.name || '');
  let escaped = escapeHtml(stripped);
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
  return lines.map((ln, lineIndex) => {
    // For the very first line, remove a leading title duplicate if present
    if (lineIndex === 0 && props.task?.name) {
      ln = stripTitleFrom(ln, props.task.name);
    }
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

const displayDate = computed(() => {
  const task = props.task || ({} as any);
  const dateStr = (task.date || task.eventDate || '').toString();
  if (!dateStr) return '';
  return formatDisplayDate(dateStr);
});

/**
 * If `text` begins with `title` (ignoring case and surrounding whitespace),
 * remove the title and any common separators that follow it (e.g. " - ", ": ", "—", newline).
 */
function stripTitleFrom(text = '', title = '') {
  if (!text || !title) return text;
  const t = title.trim();
  if (!t) return text;
  const pattern = new RegExp(
    '^\\s*' + escapeRegExp(t) + '(?:\\s*[-:—\\|]+\\s*|\\s+|\\s*\\n\\s*)?',
    'i',
  );
  return text.replace(pattern, '');
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Compute hours diff for preview display when task has exact time
const eventTimeHoursDisplay = computed(() => {
  const task = props.task || ({} as any);
  const dateStr = (task.date || task.eventDate || '').toString();
  const timeStr = task.eventTime || '';
  return formatEventHoursDiff(dateStr, timeStr);
});

// Copy helper functions
async function copyStyledTask() {
  const t = toRaw(props.task || ({} as any));
  const html = buildHtmlFromParsed(parsedLines.value, t);
  const text = buildPlainTextFromParsed(parsedLines.value, t);
  try {
    const nav: any = navigator as any;
    if (nav.clipboard && nav.clipboard.write && typeof ClipboardItem !== 'undefined') {
      const blobHtml = new Blob([html], { type: 'text/html' });
      const blobText = new Blob([text], { type: 'text/plain' });
      await nav.clipboard.write([
        new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText }),
      ]);
    } else if (nav.clipboard && nav.clipboard.writeText) {
      await nav.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  } catch (err) {
    logger.error('Copy failed', err);
  }
}

function buildPlainTextFromParsed(
  parsed: Array<{ type: string; raw: string; html: string; checked?: boolean }>,
  task: any,
) {
  const lines: string[] = [];
  // omit title per user request; include date/time only (formatted)
  if (task.date || task.eventTime) {
    try {
      const d = task.date || task.eventDate || '';
      const disp = d ? format(new Date(d), 'EEEE, dd.MM.yyyy') : '';
      lines.push(`${disp} ${task.eventTime || ''}`.trim());
    } catch (e) {
      lines.push(`${task.date || ''} ${task.eventTime || ''}`.trim());
    }
  }
  lines.push('');
  for (const item of parsed) {
    if (item.type === 'list') {
      let raw = item.raw || '';
      raw = raw.replace(/^\s*[-*]\s*/, '').replace(/^\s*\d+[.)]\s*/, '');
      const checked = !!item.checked || /^\s*\[[xX]\]\s*/.test(item.raw || '');
      const clean = raw.replace(/^\s*\[[xX]\]\s*/, '').trim();
      lines.push(`${checked ? '✔' : '-'} ${clean}`);
    } else {
      const text = (item.raw || '').trim();
      if (text) lines.push(text);
    }
  }
  // omit priority/group per user request
  return lines.join('\n');
}

function buildHtmlFromParsed(
  parsed: Array<{ type: string; raw: string; html: string; checked?: boolean }>,
  task: any,
) {
  const esc = (s = '') =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // use shared `priorityColors` imported from theme
  const parts: string[] = [];
  // overall container; use default font for title (omitted) and smaller font for content
  parts.push('<div style="font-family: Arial, Helvetica, sans-serif; color: #222;">');
  // include only date/time (no title)
  if (task.date || task.eventTime) {
    try {
      const d = task.date || task.eventDate || '';
      const disp = d ? format(new Date(d), 'EEEE, dd.MM.yyyy') : '';
      parts.push(
        `<div style="color:#666;font-size:0.9em;margin-bottom:8px;">${esc(disp)} ${esc(task.eventTime || '')}</div>`,
      );
    } catch (e) {
      parts.push(
        `<div style="color:#666;font-size:0.9em;margin-bottom:8px;">${esc(task.date || '')} ${esc(task.eventTime || '')}</div>`,
      );
    }
  }
  // Render content using parsed lines; lists get smaller font
  const listItems = parsed.filter((p) => p.type === 'list');
  if (listItems.length > 0) {
    parts.push(
      '<ul style="padding-left:18px;margin-top:0;margin-bottom:8px;font-size:13px;line-height:1.4;font-weight:normal;">',
    );
    for (const item of listItems) {
      const checked = !!item.checked || /^\s*\[[xX]\]\s*/.test(item.raw || '');
      parts.push(
        `<li style="margin-bottom:4px;font-weight:normal;">${checked ? '&#x2705; ' : ''}${item.html}</li>`,
      );
    }
    parts.push('</ul>');
  } else {
    for (const item of parsed) {
      if (item.type === 'text' && item.html && item.html.trim()) {
        parts.push(
          `<p style="margin:0 0 6px 0;font-size:13px;line-height:1.4;font-weight:normal;">${item.html}</p>`,
        );
      }
    }
  }
  // omit priority/group per user request
  parts.push('</div>');
  return parts.join('');
}
</script>

<style scoped>
.shrinking {
  /* marker class for JS-driven collapse; JS handles explicit height/padding/margin animation */
  overflow: hidden;
}

.collapse-wrapper {
  overflow: hidden;
  display: block;
}
</style>

<style scoped>
/* Date larger and blue, time green */
.preview-datetime {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.preview-date {
  color: #1976d2;
  font-size: 1.05rem;
  font-weight: 600;
}
.preview-time {
  color: #2e7d32;
  font-size: 1.05rem;
  font-weight: 600;
  margin-left: 4px;
}

.preview-date.insignificant {
  color: #9e9e9e;
  font-size: 0.85rem;
  font-weight: 400;
}

/* Reduce spacing and line-height for todo subtask list in preview */
.task-preview .q-item {
  padding-top: 4px !important;
  padding-bottom: 4px !important;
  /* allow smooth height-based collapse: set an ample max-height and enable transitions */
  max-height: 200px;
  min-height: 0 !important;
  height: auto !important;
  box-sizing: border-box;
  overflow: hidden;
  transition:
    max-height 0.5s ease-in-out,
    padding 0.5s ease-in-out,
    margin 0.5s ease-in-out;
}
.task-preview .q-item {
  padding-top: 4px !important;
  padding-bottom: 4px !important;
  /* allow smooth height-based collapse: set an ample max-height and enable transitions */
  max-height: 1000px;
  min-height: 0 !important;
  height: auto !important;
  box-sizing: border-box;
  overflow: hidden;
  transition:
    max-height 0.5s ease-in-out,
    padding 0.5s ease-in-out,
    margin 0.5s ease-in-out;
}
.task-preview .q-item .q-item-section {
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  min-height: 0 !important;
}
.task-preview .q-item .q-item-section div {
  line-height: 1.15 !important;
  font-size: 13px;
}
.task-preview .q-mb-xs {
  margin-bottom: 6px !important;
  line-height: 1.15 !important;
}
</style>
