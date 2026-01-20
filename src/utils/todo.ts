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
