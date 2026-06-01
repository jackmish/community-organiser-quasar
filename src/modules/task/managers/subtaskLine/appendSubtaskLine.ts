/** Task fields used when appending a `- …` subtask line to a description. */
export type SubtaskLineTaskRef = {
  description?: string;
  name?: string;
};

/**
 * Append a new dash-list subtask line to a task description (same rules as preview quick-add).
 * Returns the updated description, or null when `text` is empty/invalid.
 */
export function appendSubtaskLineToDescription(
  task: SubtaskLineTaskRef,
  text: string,
): string | null {
  try {
    if (!task || typeof text !== 'string' || !text.trim()) return null;
    const cur = task.description || '';
    const lines = cur.split(/\r?\n/);
    let lastStarredUndone = -1;
    for (let i = 0; i < lines.length; i++) {
      try {
        const ln = lines[i] || '';
        const dashMatch = ln.match(/^\s*-\s*(.*)$/);
        if (!dashMatch) continue;
        const content = dashMatch[1] || '';
        const checked = /^\s*\[[xX]\]/.test(content);
        const starred = /\*\s*$/.test(content);
        if (starred && !checked) lastStarredUndone = i;
      } catch {
        // ignore per-line parse errors
      }
    }

    let updated: string;
    if (lastStarredUndone >= 0) {
      const newLines = [...lines];
      newLines.splice(lastStarredUndone + 1, 0, `- ${text}`);
      updated = newLines.join('\n');
    } else {
      const title = (task.name || '').trim();
      if (title && lines.length > 0) {
        const first = lines[0] || '';
        const firstNorm = first.trim().toLowerCase();
        const titleNorm = title.toLowerCase();
        if (firstNorm.startsWith(titleNorm)) {
          if (lines.length === 1) {
            updated = `${first}\n- ${text}`;
          } else {
            updated = `${first}\n- ${text}\n${lines.slice(1).join('\n')}`;
          }
        } else {
          updated = cur ? `- ${text}\n${cur}` : `- ${text}`;
        }
      } else {
        updated = cur ? `- ${text}\n${cur}` : `- ${text}`;
      }
    }

    return updated;
  } catch {
    return null;
  }
}
