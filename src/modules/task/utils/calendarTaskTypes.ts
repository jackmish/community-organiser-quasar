/** Task types stored by day but not shown as calendar month events. */
export function isExcludedFromCalendarTask(
  task: { type_id?: string; type?: string } | null | undefined,
): boolean {
  const typeId = String(task?.type_id || task?.type || "");
  return typeId === "Todo" || typeId === "Replenish" || typeId === "NoteLater";
}

export function showsOnCalendarTask(
  task: { type_id?: string; type?: string } | null | undefined,
): boolean {
  return !isExcludedFromCalendarTask(task);
}
