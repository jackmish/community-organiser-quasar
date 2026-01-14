<template>
  <div ref="containerRef" class="next-events-container q-ml-md">
    <div :class="['next-events-row', { collapsed: collapsed, expanded: !collapsed }]">
      <template v-if="nextEvents.length">
        <div
          v-for="ev in nextEvents"
          :key="ev.id + '-' + (ev.eventTime || '') + '-' + (ev._date || '')"
          class="next-event"
          :style="{ backgroundColor: priorityColor(ev) || 'transparent', color: priorityText(ev) }"
          @click.prevent.stop="onClickEvent(ev)"
          role="button"
          tabindex="0"
        >
          <q-icon :name="iconFor(ev)" size="16" />
          <div class="next-event-text">
            <div class="next-event-title">{{ ev.name }}</div>
            <div class="next-event-meta text-caption">{{ formatEventDisplay(ev) }}</div>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="next-event-placeholder text-caption text-grey-6 q-pa-xs">
          No upcoming events
        </div>
      </template>
      <!-- expand/collapse button rendered inside the notifications row so it floats relative to it -->
      <div v-if="hasMore" class="next-events-toggle">
        <q-btn
          dense
          flat
          round
          :icon="collapsed ? 'expand_more' : 'expand_less'"
          @click.stop="toggleCollapsed"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, onBeforeUnmount, watch, nextTick } from 'vue';
import { useDayOrganiser } from '../modules/day-organiser';
import { priorityColors, priorityTextColor, priorityDefinitions, typeIcons } from './theme';
import { occursOnDay, getCycleType, getRepeatDays } from '../utils/occursOnDay';

const { organiserData, setCurrentDate, setPreviewTask, getTasksInRange, loadData } =
  useDayOrganiser();

const containerRef = ref<HTMLElement | null>(null);

function refreshNotifications() {
  try {
    if (typeof loadData === 'function') loadData();
  } catch (e) {
    // ignore
  }
}

onMounted(() => {
  // Ensure organiser data is loaded so notifications can compute tasks
  try {
    if (typeof loadData === 'function') loadData();
  } catch (e) {
    // ignore
  }
});

function formatDateLabel(dateStr?: string) {
  if (!dateStr) return '';
  const dt = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const evMid = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const diffMs = evMid.getTime() - todayMid.getTime();
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days > 1 && days <= 6) {
    return dt.toLocaleDateString(undefined, { weekday: 'long' });
  }
  return dt.toLocaleDateString();
}

// occursOnDay and repeat helpers moved to ../utils/occursOnDay

const nextEvents = computed(() => {
  // Touch organiserData to ensure this computed tracks changes to the store
  // (some callers mutate nested structures and explicit access guarantees reactivity)
  void organiserData.value;
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');

  // Build the next 30 local dates as YYYY-MM-DD
  const windowDays = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });

  // Gather tasks
  let allTasks: any[] = [];
  try {
    allTasks =
      typeof getTasksInRange === 'function' ? getTasksInRange('1970-01-01', '9999-12-31') : [];
  } catch (e) {
    const days = organiserData.value?.days || {};
    Object.keys(days).forEach((d) => {
      const day = days[d];
      if (day && Array.isArray(day.tasks)) allTasks.push(...day.tasks);
    });
  }

  // Build occurrence objects with precise local Date for the occurrence
  const occurrences: Array<{ task: any; occ: Date; dateStr: string }> = [];

  for (const t of allTasks) {
    const done = Number(t.status_id) === 0;
    const cycleType = getCycleType(t);
    if (!cycleType && done) continue;

    const addOccurrence = (dateStr: string) => {
      // compute local Date for this occurrence
      const [y, m, d] = dateStr.split('-').map((p) => Number(p));
      if (!y || !m || !d) return;
      let occ: Date;
      if (t.eventTime) {
        const [hh, mm] = (t.eventTime || '').split(':').map((p: string) => Number(p || 0));
        occ = new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0);
      } else {
        occ = new Date(y, m - 1, d, 0, 0, 0, 0);
      }
      occurrences.push({ task: t, occ, dateStr });
    };

    if (cycleType) {
      for (const day of windowDays) {
        try {
          if (occursOnDay(t, day)) addOccurrence(day);
        } catch (e) {
          // ignore
        }
      }
    } else {
      const date = t.date || t.eventDate || null;
      if (date && windowDays.includes(date)) addOccurrence(date);
    }
  }

  // Keep only occurrences: cyclic must be >= now, non-cyclic allowed if >= now - 1 hour
  const cutoff = new Date(now.getTime() - 60 * 60 * 1000);
  const future = occurrences.filter((o) => {
    const isCyclic = Boolean(getCycleType(o.task));
    return isCyclic ? o.occ.getTime() >= now.getTime() : o.occ.getTime() >= cutoff.getTime();
  });

  // Sort by occurrence datetime
  future.sort((a, b) => a.occ.getTime() - b.occ.getTime());

  // Dedupe by task id + date + time and return up to 10
  const out: any[] = [];
  const seen = new Set<string>();
  for (const o of future) {
    const key = `${o.task.id}-${o.dateStr}-${o.task.eventTime || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const item = { ...o.task, _date: o.dateStr };
    out.push(item);
    if (out.length >= 10) break;
  }

  return out;
});

// Collapse/expand behavior: default collapsed, show only a few when collapsed
const collapsed = ref(true);
const COLLAPSE_VISIBLE = 3;

const hasMore = computed(() => (nextEvents.value || []).length > COLLAPSE_VISIBLE);

function toggleCollapsed() {
  collapsed.value = !collapsed.value;
  // no positioning logic — CSS handles collapsed vs expanded inline
}

// no overlay positioning needed when expanded inline

// Click-away: collapse when clicking outside the container when expanded
function handleDocumentClick(evt: MouseEvent) {
  try {
    const el = containerRef.value;
    if (!el) return;
    const target = evt.target as Node | null;
    if (!target) return;
    // if click is outside the trigger container, collapse
    if (!el.contains(target)) collapsed.value = true;
  } catch (e) {
    // ignore
  }
}

watch(collapsed, (val) => {
  nextTick(() => {
    if (!val) {
      document.addEventListener('click', handleDocumentClick);
      document.addEventListener('keydown', onKeyDown);
    } else {
      document.removeEventListener('click', handleDocumentClick);
      document.removeEventListener('keydown', onKeyDown);
    }
  });
});

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') collapsed.value = true;
}

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick);
  document.removeEventListener('keydown', onKeyDown);
});

function formatEventDisplay(ev: any) {
  const dateStr = (ev && (ev._date || ev.date || ev.eventDate)) || '';
  const dateLabel = formatDateLabel(dateStr);
  const timePart = ev.eventTime ? ` • ${ev.eventTime}` : '';
  return `${dateLabel}${timePart}`;
}

function priorityColor(ev: any) {
  if (!ev) return '';
  return priorityColors[String(ev.priority)] || '';
}

function priorityText(ev: any) {
  if (!ev) return 'white';
  return priorityTextColor(ev.priority);
}

function iconFor(ev: any) {
  if (!ev) return 'notifications';
  const pd = ev.priority ? priorityDefinitions[String(ev.priority)] : null;
  if (pd && pd.icon) return pd.icon;
  if (ev.type_id && typeIcons[ev.type_id]) return typeIcons[ev.type_id];
  return 'notifications';
}

function onClickEvent(ev: any) {
  if (!ev) return;
  try {
    setCurrentDate(ev._date || ev.date || ev.eventDate || null);
  } catch (e) {
    // ignore
  }
  try {
    // Pass the full event payload so viewers can use the occurrence date for cyclic events
    setPreviewTask(ev || null);
  } catch (e) {
    // ignore
  }
}
</script>

<style scoped>
.next-event {
  max-width: 220px;
  padding: 6px 8px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition:
    border-color 120ms ease,
    filter 120ms ease;
  border: 1px solid transparent;
}
.next-events-row {
  position: absolute;
  /* original placement: leave slightly more space from the right so toggle doesn't overlap */
  right: 56px;
  top: 0;
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 4px 8px; /* small left/right padding so list doesn't touch edges */
  flex: 0 0 auto;
  min-width: 0;
  /* allow wrapping to next line when items don't fit */
  flex-wrap: wrap;
}

.next-events-row.collapsed {
  max-height: 48px; /* one row height */
  overflow: hidden;
}

.next-events-toggle {
  display: flex;
  align-items: center;
  position: absolute;
  right: 8px;
  top: 3px;
  transform: none;
  z-index: 2500;
  /* floating appearance */
  background: rgba(255, 255, 255, 0.04);
  border-radius: 999px;
  padding: 4px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
}

.next-events-container {
  position: relative;
  width: 100%;
  min-height: 48px; /* reserve header space so absolute row doesn't change layout */
  overflow: visible;
}

/* panel that appears when expanded: absolutely positioned so header height doesn't change */
.next-events-row.expanded {
  /* only change background and max-height when expanded */
  background: #0d47a1; /* expanded blue */
  max-height: 999px;
  overflow: hidden;
}

.next-events-container {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  min-height: 48px;
  overflow: visible;
}

.next-events-panel {
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  padding: 12px;
  display: block;
}
.next-events-panel-footer {
  margin-top: 8px;
  display: flex;
  justify-content: flex-end;
}

.next-events-row .next-event {
  flex: 0 0 auto;
}
.next-event-title {
  font-weight: 600;
  line-height: 1;
  font-size: 13px;
  right: 8px;
  top: 8px;
  transform: none;
}
.next-event-meta {
  line-height: 1;
}

.next-event-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.next-event:hover {
  border-color: rgba(0, 0, 0, 0.12);
  /* Inverted effect: slightly darken the notification on hover for stronger contrast */
  filter: brightness(0.94);
}

.next-event:focus {
  outline: none;
  border-color: rgba(0, 0, 0, 0.14);
}
</style>
