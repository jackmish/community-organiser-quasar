<template>
  <div v-if="nextEvents.length" class="next-events-row q-ml-md">
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
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useDayOrganiser } from '../modules/day-organiser';
import { priorityColors, priorityTextColor, typeIcons, priorityIcons } from './theme';

const { organiserData, setCurrentDate, setPreviewTask, getTasksInRange } = useDayOrganiser();

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

function occursOnDay(task: any, day: string): boolean {
  if (!task) return false;

  if (task.repeatMode === 'cyclic') {
    const cycle = task.repeatCycleType || 'dayWeek';
    const target = new Date(day);

    if (cycle === 'dayWeek') {
      const dow = target.getDay();
      const map = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const key = map[dow];
      const days = Array.isArray(task.repeatDays) ? task.repeatDays : [];
      return days.indexOf(key) !== -1;
    }

    if (cycle === 'month') {
      if (!task.eventDate) return false;
      const seed = new Date(task.eventDate);
      return seed.getDate() === target.getDate();
    }

    if (cycle === 'year') {
      if (!task.eventDate) return false;
      const seed = new Date(task.eventDate);
      return seed.getDate() === target.getDate() && seed.getMonth() === target.getMonth();
    }

    return false;
  }

  return true;
}

const nextEvents = computed(() => {
  const iso = new Date().toISOString();
  const todayStr = iso.split('T')[0] ?? '';
  if (!todayStr) return [];

  // Build a window of dates (today .. today+29)
  const windowDays: string[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    windowDays.push(d.toISOString().slice(0, 10));
  }

  // Collect all known tasks
  let allTasks: any[] = [];
  try {
    allTasks =
      typeof getTasksInRange === 'function' ? getTasksInRange('1970-01-01', '9999-12-31') : [];
  } catch (e) {
    // fallback to organiserData days
    const days = organiserData.value?.days || {};
    Object.keys(days).forEach((d) => {
      const day = days[d];
      if (day && Array.isArray(day.tasks)) allTasks.push(...day.tasks);
    });
  }

  const instances: any[] = [];

  for (const t of allTasks) {
    const done = t.completed || Number(t.status_id) === 0;
    if (done) continue;

    if (t.repeatMode === 'cyclic') {
      // For cyclic tasks, generate instances for matching window days
      for (const d of windowDays) {
        if (occursOnDay(t, d)) {
          instances.push({ ...t, _date: d });
        }
      }
    } else {
      const date = t.date || t.eventDate || null;
      if (date && windowDays.indexOf(date) !== -1) {
        instances.push({ ...t, _date: date });
      }
    }
  }

  // Sort instances by date/time
  instances.sort((a, b) => {
    if (a._date !== b._date) return a._date.localeCompare(b._date);
    const ta = a.eventTime || '';
    const tb = b.eventTime || '';
    return ta.localeCompare(tb);
  });

  // Exclude today's events older than 1 hour
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const filtered = instances.filter((ev) => {
    if (ev._date !== todayStr) return true;
    if (!ev.eventTime) return true;
    const datePart = (ev._date || '') as string;
    const timePart = ev.eventTime || '';
    const dt = new Date(`${datePart}T${timePart}:00`);
    return dt >= oneHourAgo;
  });

  // Return up to 5 unique instances (avoid duplicate ids on same date/time)
  const output: any[] = [];
  const seen = new Set<string>();
  for (const ev of filtered) {
    const key = `${ev.id}-${ev._date}-${ev.eventTime || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(ev);
    if (output.length >= 5) break;
  }

  return output;
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
