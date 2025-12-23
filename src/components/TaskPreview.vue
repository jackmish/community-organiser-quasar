<template>
  <q-card class="q-mb-md">
    <q-card-section>
        <!-- header removed: preview renders content only -->
        <div class="row items-start justify-end q-mb-sm">
          <q-btn dense flat icon="content_copy" label="Copy" @click="copyStyledTask" />
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
import { computed, toRaw } from 'vue';
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

/**
 * If `text` begins with `title` (ignoring case and surrounding whitespace),
 * remove the title and any common separators that follow it (e.g. " - ", ": ", "—", newline).
 */
function stripTitleFrom(text = '', title = '') {
  if (!text || !title) return text;
  const t = title.trim();
  if (!t) return text;
  const pattern = new RegExp('^\\s*' + escapeRegExp(t) + "(?:\\s*[-:—\\|]+\\s*|\\s+|\\s*\\n\\s*)?", 'i');
  return text.replace(pattern, '');
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Copy helper functions
async function copyStyledTask() {
  const t = toRaw(props.task || {} as any);
  const html = buildHtmlFromParsed(parsedLines.value, t);
  const text = buildPlainTextFromParsed(parsedLines.value, t);
  try {
    const nav: any = navigator as any;
    if (nav.clipboard && nav.clipboard.write && typeof ClipboardItem !== 'undefined') {
      const blobHtml = new Blob([html], { type: 'text/html' });
      const blobText = new Blob([text], { type: 'text/plain' });
      await nav.clipboard.write([new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })]);
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
    console.log('Copied styled task to clipboard');
  } catch (err) {
    console.error('Copy failed', err);
  }
}

function buildPlainTextFromParsed(parsed: Array<{ type: string; raw: string; html: string; checked?: boolean }>, task: any) {
  const lines: string[] = [];
  // omit title per user request; include date/time only
  if (task.date || task.eventTime) lines.push(`${task.date || ''} ${task.eventTime || ''}`.trim());
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

function buildHtmlFromParsed(parsed: Array<{ type: string; raw: string; html: string; checked?: boolean }>, task: any) {
  const esc = (s = '') => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const priorityColors: Record<string,string> = {
    low: '#26c6da',
    medium: '#6d4c41',
    high: '#ff9800',
    critical: '#f44336',
  };
  const parts: string[] = [];
  // overall container; use default font for title (omitted) and smaller font for content
  parts.push('<div style="font-family: Arial, Helvetica, sans-serif; color: #222;">');
  // include only date/time (no title)
  if (task.date || task.eventTime) {
    parts.push(`<div style="color:#666;font-size:0.9em;margin-bottom:8px;">${esc(task.date || '')} ${esc(task.eventTime || '')}</div>`);
  }
  // Render content using parsed lines; lists get smaller font
  const listItems = parsed.filter(p => p.type === 'list');
  if (listItems.length > 0) {
    parts.push('<ul style="padding-left:18px;margin-top:0;margin-bottom:8px;font-size:13px;line-height:1.4;font-weight:normal;">');
    for (const item of listItems) {
      const checked = !!item.checked || /^\s*\[[xX]\]\s*/.test(item.raw || '');
      parts.push(`<li style="margin-bottom:4px;font-weight:normal;">${checked? '&#x2705; ' : ''}${item.html}</li>`);
    }
    parts.push('</ul>');
  } else {
    for (const item of parsed) {
      if (item.type === 'text' && item.html && item.html.trim()) {
        parts.push(`<p style="margin:0 0 6px 0;font-size:13px;line-height:1.4;font-weight:normal;">${item.html}</p>`);
      }
    }
  }
  // omit priority/group per user request
  parts.push('</div>');
  return parts.join('');
}
</script>
