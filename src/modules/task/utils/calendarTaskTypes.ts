export const NOTE_TASK_TYPE_ID = "NoteLater";

export function isNoteTaskType(
  task: { type_id?: string; type?: string } | null | undefined,
): boolean {
  return String(task?.type_id || task?.type || "") === NOTE_TASK_TYPE_ID;
}

/** Task types stored by day but not shown as calendar month events. */
export function isExcludedFromCalendarTask(
  task: { type_id?: string; type?: string } | null | undefined,
): boolean {
  const typeId = String(task?.type_id || task?.type || "");
  return typeId === "Todo" || typeId === "Replenish" || typeId === NOTE_TASK_TYPE_ID;
}

export function showsOnCalendarTask(
  task: { type_id?: string; type?: string } | null | undefined,
): boolean {
  return !isExcludedFromCalendarTask(task);
}
