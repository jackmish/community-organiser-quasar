export type CalendarTaskIndicatorSource = {
  name?: string | null;
  eventTime?: string | null;
  timeMode?: string | null;
};

/** Two-character label for mobile calendar top indicators (matches calendar pill rules). */
export function getCalendarTaskIndicatorLabel(task: CalendarTaskIndicatorSource): string {
  const hasTime = !!task.eventTime && task.timeMode !== "holiday";
  if (hasTime) {
    const time = String(task.eventTime).trim();
    const colonIdx = time.indexOf(":");
    if (colonIdx > 0) return time.slice(0, colonIdx);
    return [...time].slice(0, 2).join("");
  }
  const name = String(task.name ?? "").trim();
  return [...name].slice(0, 2).join("");
}
