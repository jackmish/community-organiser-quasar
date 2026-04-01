import { ref } from 'vue';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function formatYmdLocal(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseYmdLocal(s: string | undefined | null): Date | null {
  if (!s || typeof s !== 'string') return null;
  const parts = s.split('-');
  if (parts.length < 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return new Date(y, m - 1, d);
}

export function construct() {
  const currentDate = ref<string>(formatYmdLocal(new Date()));
  const days = ref<Record<string, any>>({});
  const lastModified = ref<string>(new Date().toISOString());

  return {
    currentDate,
    setCurrentDate: (date: string | null) => {
      if (date && typeof date === 'string') {
        // Normalize to YYYY-MM-DD (strip time part if present)
        const part = date.indexOf('T') !== -1 ? date.split('T')[0] : date;
        currentDate.value = String(part);
      }
    },
    goToToday: () => {
      currentDate.value = formatYmdLocal(new Date());
    },
    nextDay: () => {
      try {
        const d = parseYmdLocal(currentDate.value) || new Date();
        d.setDate(d.getDate() + 1);
        currentDate.value = formatYmdLocal(d);
      } catch (e) {
        // ignore
      }
    },
    prevDay: () => {
      try {
        const d = parseYmdLocal(currentDate.value) || new Date();
        d.setDate(d.getDate() - 1);
        currentDate.value = formatYmdLocal(d);
      } catch (e) {
        // ignore
      }
    },
    // Days map (date -> DayData)
    days,
    // Last modified timestamp for organiser data
    lastModified,
  } as const;
}
