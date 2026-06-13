export type TodoSubtaskLine = { raw: string; text: string };

const TODO_LIST_ITEM_RE =
  /^\s*(?:[-*+]|(?:\d+[.)]))\s*(?:\[\s*([^\]\s])?\s*\])?\s*(.*)$/;

function isCheckedSubtaskMark(mark: string | undefined): boolean {
  if (!mark) return false;
  const lower = String(mark).toLowerCase();
  return lower === 'x' || mark === '✓' || mark === '✔' || mark === '☑';
}

/** Unchecked list-item lines from a todo description (optionally capped). */
export function parseUndoneSubtasks(description: string, maxItems?: number): TodoSubtaskLine[] {
  if (!description) return [];
  const lines = description.split(/\r?\n/);
  const result: TodoSubtaskLine[] = [];

  for (const ln of lines) {
    const m = ln.match(TODO_LIST_ITEM_RE);
    if (!m) continue;
    if (isCheckedSubtaskMark(m[1])) continue;
    const text = (m[2] ?? '').replace(/\s*\*\s*$/, '').trim();
    if (!text) continue;
    result.push({ raw: ln, text });
    if (maxItems != null && result.length >= maxItems) break;
  }

  return result;
}

export const countTodoSubtasks = (task: any) => {
  const desc = (task?.description || '') + '';
  if (!desc) return { done: 0, total: 0 };
  const lines = desc.split(/\r?\n/);
  let total = 0;
  let done = 0;
  const listItemRe = /^\s*(?:[-*+]|(?:\d+[.)]))\s*(?:\[\s*([^\]\s])?\s*\])?/;
  for (const l of lines) {
    const m = l.match(listItemRe);
    if (m) {
      total += 1;
      const mark = m[1];
      if (mark) {
        const lower = String(mark).toLowerCase();
        if (lower === 'x' || mark === '✓' || mark === '✔' || mark === '☑') done += 1;
      }
    }
  }
  return { done, total };
};

export const countStarredUndone = (task: any) => {
  const desc = (task?.description || '') + '';
  if (!desc) return 0;
  const lines = desc.split(/\r?\n/);
  let count = 0;
  const listItemRe = /^\s*(?:[-*+]|(?:\d+[.)]))\s*(?:\[\s*([^\]\s])?\s*\])?/;
  for (const l of lines) {
    const m = l.match(listItemRe);
    if (m) {
      const mark = m[1];
      const checked =
        mark &&
        (String(mark).toLowerCase() === 'x' || mark === '✓' || mark === '✔' || mark === '☑');
      const hasStar = /\*\s*$/.test(l);
      if (!checked && hasStar) count += 1;
    }
  }
  return count;
};
