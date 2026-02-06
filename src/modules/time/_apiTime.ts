import { ref } from 'vue';

export function createTimeApi() {
  const currentDate = ref<string>(new Date().toISOString().split('T')[0] ?? '');

  return {
    currentDate,
    setCurrentDate: (date: string | null) => {
      if (date && typeof date === 'string') currentDate.value = date;
    },
    goToToday: () => {
      currentDate.value = String(new Date().toISOString().split('T')[0] || '');
    },
    nextDay: () => {
      try {
        const d = new Date(currentDate.value);
        d.setDate(d.getDate() + 1);
        currentDate.value = String(d.toISOString().split('T')[0] || '');
      } catch (e) {
        // ignore
      }
    },
    prevDay: () => {
      try {
        const d = new Date(currentDate.value);
        d.setDate(d.getDate() - 1);
        currentDate.value = String(d.toISOString().split('T')[0] || '');
      } catch (e) {
        // ignore
      }
    },
  } as const;
}
