<template>
  <div class="next-events-row q-ml-md">
    <template v-if="nextEvents.length">
      <div
        v-for="ev in nextEvents"
        :key="ev.id + '-' + (ev.eventTime || '')"
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
      <div class="next-event-placeholder text-caption text-grey-6 q-pa-xs">No upcoming events</div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useDayOrganiser } from '../modules/day-organiser';
import { priorityColors, priorityTextColor, typeIcons, priorityIcons } from './theme';
import { occursOnDay, getCycleType, getRepeatDays } from '../utils/occursOnDay';

const { organiserData, setCurrentDate, setPreviewTask, getTasksInRange, loadData } =
  useDayOrganiser();

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

  // Dedupe by task id + date + time and return up to 5
  const out: any[] = [];
  const seen = new Set<string>();
  for (const o of future) {
    const key = `${o.task.id}-${o.dateStr}-${o.task.eventTime || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const item = { ...o.task, _date: o.dateStr };
    out.push(item);
    if (out.length >= 5) break;
  }

  return out;
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
  if (ev.priority && priorityIcons[String(ev.priority)]) return priorityIcons[String(ev.priority)];
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
    setPreviewTask(ev.id || null);
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
  display: flex;
  gap: 8px;
  align-items: center;
  overflow-x: auto;
  padding: 4px 0;
}

.next-events-row .next-event {
  flex: 0 0 auto;
}
.next-event-title {
  font-weight: 600;
  line-height: 1;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
