<template>
  <q-card
    :class="['q-mb-md task-preview', { 'fixed-preview': props.fixed !== false }]"
    :style="previewCardStyle"
  >
    <q-card-section>
      <!-- header: title on left, copy on right -->
      <div class="row items-center justify-between q-mb-sm">
        <div class="text-h5">{{ task.name }}</div>
        <div style="display: flex; gap: 8px; align-items: center">
          <q-btn
            dense
            unelevated
            color="orange"
            icon="edit"
            label="Edit"
            @click.stop="$emit('edit')"
          />
          <q-btn dense flat icon="content_copy" label="Copy" @click="copyStyledTask" />
        </div>
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
              clickable
              :class="priorityChipClass(task.priority)"
              :style="priorityChipStyle(task.priority)"
            >
              {{ task.priority }}
              <q-menu
                v-model="priorityMenu"
                anchor="bottom right"
                self="top right"
                content-class="priority-menu"
              >
                <q-list style="min-width: 0; padding: 4px 0" dense>
                  <q-item
                    v-for="p in Object.keys(priorityDefinitions)"
                    :key="p"
                    clickable
                    dense
                    @click="selectPriority(p)"
                    :class="['use-default', menuItemClass(p)]"
                    :style="menuItemStyle(p)"
                  >
                    <q-item-section
                      side
                      style="
                        width: 36px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                      "
                    >
                      <q-icon
                        :name="(priorityIcons as any)[p] || 'label'"
                        :color="priorityTextColor(p)"
                      />
                    </q-item-section>
                    <q-item-section>
                      <div :style="{ color: priorityTextColor(p), fontWeight: 600 }">{{ p }}</div>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-chip>
            <div class="q-ml-sm">
              <q-chip
                size="sm"
                icon="folder"
                class="q-pointer"
                clickable
                @click.stop="groupMenu = true"
              >
                {{ groupName || 'No group' }}
              </q-chip>
              <q-menu v-model="groupMenu" anchor="bottom right" self="top right" class="group-menu">
                <q-list dense separator>
                  <q-item clickable dense @click="selectGroup(null)">
                    <q-item-section
                      side
                      style="
                        width: 36px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                      "
                    >
                      <q-icon name="clear" />
                    </q-item-section>
                    <q-item-section>
                      <div style="font-weight: 600">No group</div>
                    </q-item-section>
                  </q-item>
                  <q-separator />
                  <q-item
                    v-for="g in groups || []"
                    :key="g.id"
                    clickable
                    dense
                    @click="selectGroup(g.id)"
                  >
                    <q-item-section
                      side
                      style="
                        width: 36px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                      "
                    >
                      <q-icon name="folder" />
                    </q-item-section>
                    <q-item-section>
                      <div style="font-weight: 600">{{ g.name }}</div>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </div>
          </div>
        </div>

        <!-- quick add moved to top of description -->
        <div
          v-if="(task.type_id || '') === 'Todo' || (task.type_id || '') === 'TimeEvent'"
          class="q-mt-sm"
          style="display: flex; gap: 8px; align-items: center"
        >
          <q-input
            dense
            outlined
            type="textarea"
            autosize
            rows="1"
            placeholder="Quick add subtask"
            v-model="quickSubtask"
            @keyup.enter="addQuickSubtask"
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
            :title="quickSubtaskStar ? 'Pinned' : 'Pin'"
          />
          <q-btn dense unelevated color="positive" icon="add" @click="addQuickSubtask" />
        </div>

        <div>
          <div v-for="(line, idx) in parsedLines" :key="line.uid">
            <div v-if="line.type === 'list'">
              <div
                class="collapse-wrapper"
                :ref="(el) => setItemRef(el, idx)"
                :class="{ shrinking: props.animatingLines && props.animatingLines.includes(idx) }"
              >
                <q-item
                  clickable
                  :class="[{ highlighted: line.highlighted }, 'q-pa-none']"
                  @click.stop="api.task.subtaskLine.toggleStatus(api.task.active.task.value, idx)"
                >
                  <q-item-section side>
                    <q-icon
                      :name="line.checked ? 'check_circle' : 'radio_button_unchecked'"
                      :color="line.checked ? 'green' : 'grey-6'"
                    />
                  </q-item-section>
                  <q-item-section>
                    <div v-html="line.html"></div>
                  </q-item-section>
                  <q-item-section side class="highlight-section">
                    <q-btn
                      dense
                      flat
                      round
                      size="sm"
                      class="highlight-btn"
                      :icon="highlightIcon"
                      :color="line.highlighted ? 'amber' : 'grey-6'"
                      @click.stop="toggleHighlight(idx)"
                    />
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
  priorityIcons,
  highlightIcon,
} from '../theme';
import * as api from 'src/modules/day-organiser/_apiRoot';
import type { Task } from 'src/modules/task/types';

const props = defineProps<{
  task: Task;
  groupName?: string;
  animatingLines?: number[];
  fixed?: boolean;
}>();
// Prefer the central active task reference from the API. Use this alias
// throughout the component so callers don't need to pass a task prop.
const activeTask = api.task.active.task;
const emit = defineEmits([
  'edit',
  'close',
  'toggle-status',
  'update-task',
  'line-collapsed',
  'line-expanded',
]);

// Quick-add subtask helper
const quickSubtask = ref('');
const quickSubtaskStar = ref(false);

// refs to each rendered list item so we can animate height directly
const itemRefs = ref<Array<HTMLElement | null>>([] as Array<HTMLElement | null>);
const priorityMenu = ref(false);
const groupMenu = ref(false);
const groups = api.group.list.all;
// track pending transition fallback timers per element
const transitionFallbacks = new Map<HTMLElement, number>();

function selectPriority(p: string) {
  try {
    const t: Task = { ...toRaw(activeTask.value) } as Task;
    t.priority = p as Task['priority'];
    emit('update-task', t);
  } finally {
    priorityMenu.value = false;
  }
}

async function selectGroup(gid: string | null) {
  try {
    const updateTask = api.task.update;
    const date = (activeTask.value && (activeTask.value.date || activeTask.value.eventDate)) || '';
    if (!activeTask.value || !activeTask.value.id) return;
    const updates: any = {};
    updates.groupId = gid == null ? undefined : gid;
    await updateTask(date, activeTask.value.id, updates);
  } catch (e) {
    logger.error('Failed to update task group', e);
  } finally {
    groupMenu.value = false;
  }
}

function setItemRef(el: Element | ComponentPublicInstance | null, idx: number) {
  if (el == null) {
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
  // If we received a generic Element (e.g. SVGElement), coerce as a fallback.
  // This is uncommon but avoids a TS error when refs resolve to Element.
  try {
    const asEl = el as unknown as HTMLElement;
    if (asEl && (asEl as any).style !== undefined) {
      itemRefs.value[idx] = asEl;
      return;
    }
  } catch (e) {
    void e;
  }
  // fallback
  itemRefs.value[idx] = null;
}

function addQuickSubtask() {
  const text = quickSubtask.value;
  // Delegate insertion and persistence to the task API which will trim/validate input.
  void api.task.subtaskLine.add(text);
  quickSubtask.value = '';
  quickSubtaskStar.value = false;
  nextTick(() => {
    // parent will re-render after API updates
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

const looksLikeCssColor = (s?: string) => !!(s && /^\s*(#|rgb|hsl)/i.test(s));

function priorityChipClass(p?: string) {
  const c = priorityColor(p);
  if (!c) return '';
  return looksLikeCssColor(c) ? '' : `bg-${c}`;
}

function priorityChipStyle(p?: string) {
  const c = priorityColor(p);
  const txt = priorityTextColor(p);
  if (looksLikeCssColor(c)) return { backgroundColor: c, color: txt } as any;
  // If c looks like a Quasar color name (not a raw CSS color), apply only text color
  return { color: txt } as any;
}

function menuItemStyle(p?: string) {
  const c = priorityColor(p);
  const txt = priorityTextColor(p);
  if (!c) return {} as any;
  // Use inline background/color for raw css colors and also set CSS variables
  if (looksLikeCssColor(c))
    return {
      backgroundColor: c,
      color: txt,
      ['--priority-bg']: c,
      ['--priority-text']: txt,
    } as any;
  // For Quasar color names we rely on bg-<color> class; still set text color variable
  return { color: txt, ['--priority-text']: txt } as any;
}

function menuItemClass(p?: string) {
  return priorityChipClass(p);
}

const groupName = computed(() => props.groupName || '');

const isTimeEvent = computed(() => (activeTask.value?.type_id || '') === 'TimeEvent');

const displayDate = computed(() => {
  const task = activeTask.value || ({} as any);
  const dateStr = (task.date || task.eventDate || '').toString();
  if (!dateStr) return '';
  return formatDisplayDate(dateStr);
});

const eventTimeHoursDisplay = computed(() => {
  const task = activeTask.value || ({} as any);
  const dateStr = (task.date || task.eventDate || '').toString();
  const timeStr = task.eventTime || '';
  return formatEventHoursDiff(dateStr, timeStr);
});

// Rendered description with simple replacements:
// - replace '[x]' with a check emoji
// - escape HTML, then convert newlines to <br>
function escapeHtml(s = '') {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeRegExp(string = '') {
  return String(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * If `text` begins with `title` (ignoring case and surrounding whitespace),
 * remove the title and any common separators that follow it (e.g. " - ", ": ", "—", "|", newline).
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

const renderedDescription = computed(() => {
  const d = props.task?.description || '';
  // If the description begins with the title, strip that prefix for preview clarity
  const stripped = stripTitleFrom(d, props.task?.name || '');
  let escaped = escapeHtml(stripped);
  escaped = escaped.replace(/\[x\]/gi, '✅');
  escaped = escaped.replace(/\n/g, '<br/>');
  return escaped;
});

// parsedLines is provided by the central task API so components share the same
// parsed representation and watcher. Use that shared ref here.
const parsedLines = api.task.subtaskLine.parsedLines;
const isDone = computed(() => Number(activeTask.value?.status_id) === 0);

function toggleHighlight(idx: number) {
  try {
    const parsed = parsedLines.value;
    const item = parsed[idx];
    if (!item || item.type !== 'list') return;
    const rawDesc = String(activeTask.value?.description || '');
    const rawLines = rawDesc.split(/\r?\n/);
    // find exact matching raw line
    let foundIdx = rawLines.findIndex((r) => r === (item?.raw || ''));
    // fallback: try loose match by stripping list marker
    if (foundIdx === -1) {
      const stripped = (item?.raw || '').replace(/^\s*[-*]\s*/, '').trim();
      foundIdx = rawLines.findIndex(
        (r) => (r || '').replace(/^\s*[-*]\s*/, '').trim() === stripped,
      );
    }
    const newLines = [...rawLines];
    if (item.highlighted) {
      // remove trailing star if present and ensure it does not remain above other starred subtasks
      if (foundIdx >= 0) {
        // compute other starred indices before changing the line
        const otherStarIdxs = newLines
          .map((l, i) => (/\s*\*\s*$/.test(l) ? i : -1))
          .filter((i) => i >= 0 && i !== foundIdx);
        const lastOtherStar = otherStarIdxs.length ? Math.max(...otherStarIdxs) : -1;
        // remove trailing star marker
        newLines[foundIdx] = (newLines[foundIdx] ?? '').replace(/\s*\*\s*$/, '');
        // If this item was above other starred items, move it below the last starred item
        if (lastOtherStar >= 0 && foundIdx < lastOtherStar) {
          const removed = newLines.splice(foundIdx, 1)[0];
          if (removed !== undefined) {
            // after removal, insert at index `lastOtherStar` which accounts for the shift
            newLines.splice(lastOtherStar, 0, removed);
          }
        }
      }
    } else {
      // add star and move to top (after title if present)
      const candidate = (item?.raw || '').replace(/\s*\*\s*$/, '') + ' *';
      if (foundIdx >= 0) {
        newLines.splice(foundIdx, 1);
      }
      const title = props.task?.name || '';
      let insertAt = 0;
      if (title && newLines.length > 0) {
        const first = newLines[0] || '';
        const titleMatch = new RegExp('^\\s*' + escapeRegExp(title) + '\\b', 'i');
        if (titleMatch.test(first)) insertAt = 1;
      }
      newLines.splice(insertAt, 0, candidate);
    }
    const updated = newLines.join('\n');
    const t = { ...toRaw(activeTask.value), description: updated } as Task;
    emit('update-task', t);
  } catch (e) {
    void e;
  }
}

async function copyStyledTask() {
  const t = toRaw(activeTask.value || ({} as any));
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
  parsed: Array<{
    type: string;
    raw: string;
    html: string;
    checked?: boolean;
    highlighted?: boolean;
  }>,
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
  parsed: Array<{
    type: string;
    raw: string;
    html: string;
    checked?: boolean;
    highlighted?: boolean;
  }>,
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
.collapse-wrapper {
  transition: max-height 0.25s ease-in-out;
}
</style>

<style scoped>
/* Highlight button: semi-transparent until hover */
.highlight-btn {
  opacity: 0.45;
  transition: opacity 120ms ease;
}
.q-item:hover .highlight-btn {
  opacity: 1;
}
.highlight-section {
  display: flex;
  align-items: center;
  padding-left: 6px;
}
/* Highlighted list item visual */
.task-preview .q-item.highlighted {
  background-color: rgba(255, 193, 7, 0.06);
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
  max-height: none;
  min-height: 0 !important;
  height: auto !important;
  box-sizing: border-box;
  overflow: visible;
  transition: none;
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

/* Compact priority menu content */
.priority-menu {
  min-width: 0 !important;
  padding: 6px !important;
}
.priority-menu .q-item {
  border-radius: 6px;
  margin: 4px 6px !important;
  padding: 6px 8px !important;
}
.priority-menu .q-item__section {
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}
/* Apply CSS variables when provided (for raw hex/rgb colors). Use !important
   so Quasar's internal backgrounds don't override our swatches. */
.priority-menu .q-item {
  background: var(--priority-bg, transparent) !important;
  color: var(--priority-text, inherit) !important;
}
.priority-menu .q-item__section,
.priority-menu .q-item__label {
  color: var(--priority-text, inherit) !important;
}
/* Global rules for teleported q-menu content (not scoped) */
</style>

<style>
.priority-menu {
  min-width: 0 !important;
  padding: 6px !important;
}
.priority-menu .q-item {
  border-radius: 6px;
  margin: 4px 6px !important;
  padding: 6px 8px !important;
  background: var(--priority-bg, transparent) !important;
  color: var(--priority-text, inherit) !important;
}
.priority-menu .q-item__section,
.priority-menu .q-item__label {
  color: var(--priority-text, inherit) !important;
}
/* Prefer a subtle brighten on hover for priority items, do not apply the global blue overlay. */
/* Ensure we outrank the global menu overlay by using the teleported menu root and body-scoped selector */
body .q-menu.priority-menu .q-item::before,
body .q-menu.priority-menu .q-item.q-item--active::before {
  background: transparent !important;
  background-image: none !important;
}

/* Use a subtle semi-transparent white overlay on hover so the colored background brightens
   instead of being replaced by the global blue overlay. */
body .q-menu.priority-menu .q-item::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background: transparent;
  transition: background-color 140ms ease !important;
  z-index: 0;
}
body .q-menu.priority-menu .q-item:hover::after {
  background: rgba(255, 255, 255, 0.06) !important;
}
body .q-menu.priority-menu .q-item.q-item--active:hover::after {
  background: rgba(255, 255, 255, 0.08) !important;
}
</style>

<style>
.task-preview.fixed-preview {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 1600;
  width: 360px;
  max-width: calc(100% - 32px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}
</style>
