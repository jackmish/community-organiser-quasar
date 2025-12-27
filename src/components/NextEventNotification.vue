<template>
  <div v-if="nextEvent" class="q-ml-md next-event" style="display:flex;align-items:center;gap:8px">
    <q-icon name="notifications" size="18" />
    <div class="next-event-text">
      <div class="next-event-title">{{ nextEvent.name }}</div>
      <div class="next-event-meta text-caption text-grey-6">{{ nextEventDisplay }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useDayOrganiser } from '../modules/day-organiser';

const { organiserData } = useDayOrganiser();

function formatDateLabel(dateStr: string) {
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

const nextEvent = computed(() => {
  const days = organiserData.value?.days || {};
  const tasks: any[] = [];
  Object.keys(days).forEach((d) => {
    const day = days[d];
    if (day && Array.isArray(day.tasks)) {
      day.tasks.forEach((t: any) => {
        const date = t.date || t.eventDate || d;
        const done = t.completed || Number(t.status_id) === 0;
        if (!done) tasks.push({ ...t, _date: date });
      });
    }
  });
  const iso = new Date().toISOString();
  const todayStr = iso.split('T')[0] ?? '';
  if (!todayStr) return null;
  const upcoming = tasks
    .filter((t) => t._date >= todayStr)
    .sort((a, b) => {
      if (a._date !== b._date) return a._date.localeCompare(b._date);
      const ta = a.eventTime || '';
      const tb = b.eventTime || '';
      return ta.localeCompare(tb);
    });
  return upcoming.length ? upcoming[0] : null;
});

const nextEventDisplay = computed(() => {
  const ev = nextEvent.value;
  if (!ev) return '';
  const dateLabel = formatDateLabel(ev._date || ev.date || ev.eventDate);
  const timePart = ev.eventTime ? ` • ${ev.eventTime}` : '';
  return `${dateLabel}${timePart}`;
});
</script>

<style scoped>
.next-event {
  max-width: 360px;
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
</style>
