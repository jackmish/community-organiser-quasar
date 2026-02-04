import type { Ref } from 'vue';
import { useClock } from 'src/composables/useClock';
import { useTimeDiff } from 'src/composables/useTimeDiff';

export type UseDayOrganiserView = {
  now: Ref<Date>;
  getTimeDifferenceDisplay: (dayDate?: string | Date | null) => string;
  getTimeDiffClass: (dayDate?: string | Date | null) => string;
};

export function useDayOrganiserView(): UseDayOrganiserView {
  const { now } = useClock();
  const { getTimeDifferenceDisplay, getTimeDiffClass } = useTimeDiff();

  return { now, getTimeDifferenceDisplay, getTimeDiffClass };
}
