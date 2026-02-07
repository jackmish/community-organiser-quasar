import { ref, watch } from 'vue';
import type { Ref } from 'vue';
import type { Task } from '../../types';
import { getCycleType } from '../../utlils/occursOnDay';

export function construct(stateOrActiveTask: any, opts?: { timeApi?: any; persist?: (date: string, taskObj: Task) => void }) {
  // Accept either a state object with `activeTask`, a direct `Ref<Task|null>`,
  // or `undefined`. If nothing is provided create an internal activeTask ref.
  let activeTask: Ref<Task | null>;
  if (
    stateOrActiveTask &&
    typeof stateOrActiveTask === 'object' &&
    'activeTask' in stateOrActiveTask
  ) {
    activeTask = stateOrActiveTask.activeTask;
  } else if (stateOrActiveTask) {
    activeTask = stateOrActiveTask as Ref<Task | null>;
  } else {
    activeTask = ref(null) as Ref<Task | null>;
  }

  const lastRawLines = ref<string[]>([] as string[]);
  const lastLineUids = ref<string[]>([] as string[]);
  let uidCounter = 1;

  const parsedLines = ref(
    [] as Array<{
      uid: string;
      type: string;
      raw: string;
      html: string;
      checked?: boolean;
      highlighted?: boolean;
    }>,
  );

  function escapeHtml(s = '') {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escapeRegExp(string = '') {
    return String(string).replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
  }

  function stripTitleFrom(text = '', title = '') {
    if (!text || !title) return text;
    const t = title.trim();
    if (!t) return text;
    const pattern = new RegExp(
      '^\\s*' + escapeRegExp(t) + '(?:\\s*[-:—\\|]+\\s*|\\s+|\\s*\\n\\s*)?',
      'i',
    );
    return text.replace(pattern, '');
  }

  function computeParsedLines(desc: string) {
    const d = desc || '';
    if (!d)
      return [] as Array<{
        uid: string;
        type: string;
        raw: string;
        html: string;
        checked?: boolean;
        highlighted?: boolean;
      }>;
    const lines = d.split(/\r?\n/);
    const prevMap = new Map<string, string[]>();
    for (let i = 0; i < lastRawLines.value.length; i++) {
      const raw = lastRawLines.value[i] || '';
      const uid = lastLineUids.value[i] || '';
      if (!prevMap.has(raw)) prevMap.set(raw, []);
      prevMap.get(raw)!.push(uid);
    }
    const newUids: string[] = [];
    for (const ln of lines) {
      const raw = ln || '';
      const queue = prevMap.get(raw);
      if (queue && queue.length > 0) {
        const reused = queue.shift();
        newUids.push(reused ?? `line-${uidCounter++}`);
      } else {
        newUids.push(`line-${uidCounter++}`);
      }
    }
    lastRawLines.value = [...lines];
    lastLineUids.value = [...newUids];

    return lines.map((ln, lineIndex) => {
      const uid = newUids[lineIndex] ?? `line-${uidCounter++}`;
      let text = ln;
      if (lineIndex === 0 && activeTask.value?.name) {
        text = stripTitleFrom(text, activeTask.value.name);
      }
      const dashMatch = text.match(/^\s*-\s*(.*)$/);
      const numMatch = text.match(/^\s*(\d+)[.)]\s*(.*)$/);
      if (dashMatch) {
        const content = dashMatch[1] || '';
        const markerMatch = content.match(/^\s*\[[xX]\]\s*/);
        const checked = !!markerMatch;
        const starMatch = content.match(/\s*\*\s*$/);
        const highlighted = !!starMatch;
        let clean = content.replace(/^\s*\[[xX]\]\s*/, '');
        clean = clean.replace(/\s*\*\s*$/, '');
        const html = escapeHtml(clean).replace(/\n/g, '<br/>');
        return { uid, type: 'list', raw: ln, html, checked, highlighted };
      }
      if (numMatch) {
        const idx = numMatch[1];
        const content = numMatch[2] || '';
        const markerMatch = content.match(/^\s*\[[xX]\]\s*/);
        const checked = !!markerMatch;
        const clean = content.replace(/^\s*\[[xX]\]\s*/, '');
        let html = escapeHtml(clean).replace(/\n/g, '<br/>');
        html = `${idx}. ${html}`;
        return { uid, type: 'list', raw: ln, html, checked };
      }
      const html = escapeHtml(text).replace(/-vv/g, '✅').replace(/\n/g, '<br/>');
      return { uid, type: 'text', raw: ln, html };
    });
  }

  watch(
    () => activeTask.value && activeTask.value.description,
    (d) => {
      parsedLines.value = computeParsedLines(String(d || ''));
    },
    { immediate: true },
  );

  // If caller passed a mutable `state` object, attach the parsedLines ref
  // directly so callers can read the service-owned parsed representation.
  try {
    if (stateOrActiveTask && typeof stateOrActiveTask === 'object') {
      stateOrActiveTask.parsedLines = parsedLines;
    }
  } catch (e) {
    // ignore
  }

  // Compute-only toggle: returns new description and optional appended index
  // without performing any persistence. The service will provide a wrapper
  // that persists the result when a `persist` callback is supplied.
  async function toggleStatus(task: any, lineIndex: number) {
    try {
      if (typeof lineIndex !== 'number' || !task || typeof task.description !== 'string')
        return null;

      const lines = (task.description || '').split(/\r?\n/);
      let appendedIndex: number | undefined = undefined;
      const ln = lines[lineIndex] ?? '';
      const dashMatch = ln.match(/^(\s*-\s*)(\[[xX]\]\s*)?(.*)$/);
      const numMatch = ln.match(/^(\s*\d+[.)]\s*)(\[[xX]\]\s*)?(.*)$/);

      if (dashMatch) {
        const prefix = dashMatch[1];
        const marker = dashMatch[2] || '';
        const content = dashMatch[3] || '';
        const checked = /^\s*\[[xX]\]\s*/.test(marker);
        const hasTitleInDesc = Boolean(lines[0] && lines[0].trim() !== '');
        const baseInsertIndex = hasTitleInDesc ? 1 : 0;
        const hadStar = /\s*\*\s*$/.test(content);
        if (checked) {
          if (lineIndex === 0 && hasTitleInDesc) {
            lines[lineIndex] = `${prefix}${content}`;
          } else {
            const completedStart = lines.findIndex(
              (ln2: string) => /^\s*-\s*\[[xX]\]/.test(ln2) || /^\s*\d+[.)]\s*\[[xX]\]/.test(ln2),
            );
            const undoneEnd = completedStart === -1 ? lines.length : completedStart;
            let lastStarIndex = -1;
            for (let i = baseInsertIndex; i < undoneEnd; i++) {
              try {
                if (/\*\s*$/.test(lines[i])) lastStarIndex = i;
              } catch (e) {
                // ignore
              }
            }
            let finalInsert = baseInsertIndex;
            if (!hadStar && lastStarIndex !== -1) finalInsert = lastStarIndex + 1;
            const adjustedFinal = finalInsert > lineIndex ? finalInsert - 1 : finalInsert;
            if (lineIndex === adjustedFinal) {
              lines[lineIndex] = `${prefix}${content}`;
            } else {
              const movedLine = `${prefix}${content}`;
              lines.splice(lineIndex, 1);
              lines.splice(adjustedFinal, 0, movedLine);
              appendedIndex = adjustedFinal;
            }
          }
        } else {
          const cleanContent = content.replace(/\s*\*\s*$/, '');
          const completedLine = `${prefix}[x] ${cleanContent}${hadStar ? ' *' : ''}`;
          lines.splice(lineIndex, 1);
          if (hadStar) {
            const completedStart = lines.findIndex(
              (ln2: string) =>
                /^(\s*-\s*\[[xX]\]\s*)/.test(ln2) || /^(\s*\d+[.)]\s*\[[xX]\]\s*)/.test(ln2),
            );
            if (completedStart === -1) {
              lines.push(completedLine);
              appendedIndex = lines.length - 1;
            } else {
              lines.splice(completedStart, 0, completedLine);
              appendedIndex = completedStart;
            }
          } else {
            lines.push(completedLine);
            appendedIndex = lines.length - 1;
          }
        }
      } else if (numMatch) {
        const prefix = numMatch[1];
        const marker = numMatch[2] || '';
        const content = numMatch[3] || '';
        const checked = /^\s*\[[xX]\]\s*/.test(marker);
        const hasTitleInDesc = Boolean(lines[0] && lines[0].trim() !== '');
        const baseInsertIndex = hasTitleInDesc ? 1 : 0;
        const hadStar = /\s*\*\s*$/.test(content);
        if (checked) {
          if (lineIndex === 0 && hasTitleInDesc) {
            lines[lineIndex] = `${prefix}${content}`;
          } else {
            const completedStart = lines.findIndex(
              (ln2: string) => /^\s*-\s*\[[xX]\]/.test(ln2) || /^\s*\d+[.)]\s*\[[xX]\]/.test(ln2),
            );
            const undoneEnd = completedStart === -1 ? lines.length : completedStart;
            let lastStarIndex = -1;
            for (let i = baseInsertIndex; i < undoneEnd; i++) {
              try {
                if (/\*\s*$/.test(lines[i])) lastStarIndex = i;
              } catch (e) {
                // ignore
              }
            }
            let finalInsert = baseInsertIndex;
            if (!hadStar && lastStarIndex !== -1) finalInsert = lastStarIndex + 1;
            const adjustedIndex = finalInsert > lineIndex ? finalInsert - 1 : finalInsert;
            if (lineIndex === adjustedIndex) {
              lines[lineIndex] = `${prefix}${content}`;
            } else {
              const movedLine = `${prefix}${content}`;
              lines.splice(lineIndex, 1);
              lines.splice(adjustedIndex, 0, movedLine);
              appendedIndex = adjustedIndex;
            }
          }
        } else {
          const hadStarLocal = /\s*\*\s*$/.test(content);
          const cleanContent = content.replace(/\s*\*\s*$/, '');
          const completedLine = `- [x] ${cleanContent}${hadStarLocal ? ' *' : ''}`;
          lines.splice(lineIndex, 1);
          if (hadStarLocal) {
            const completedStart = lines.findIndex(
              (ln2: string) =>
                /^(\s*-\s*\[[xX]\]\s*)/.test(ln2) || /^(\s*\d+[.)]\s*\[[xX]\]\s*)/.test(ln2),
            );
            if (completedStart === -1) {
              lines.push(completedLine);
              appendedIndex = lines.length - 1;
            } else {
              lines.splice(completedStart, 0, completedLine);
              appendedIndex = completedStart;
            }
          } else {
            lines.push(completedLine);
            appendedIndex = lines.length - 1;
          }
        }
      } else {
        return null;
      }

      const newDesc = lines.join('\n');
      return { newDesc, appendedIndex };
    } catch (e) {
      return null;
    }
  }

  // Compute-only add: returns computed new description (no persistence)
  async function add(task: any, text: string) {
    try {
      if (!task || typeof text !== 'string' || !text.trim()) return null;
      const cur = task.description || '';
      const lines = cur.split(/\r?\n/);
      // find last starred undone list item
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
        } catch (e) {
          // ignore
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

      return { newDesc: updated };
    } catch (e) {
      return null;
    }
  }

  // Persistence-aware wrappers: call compute-only helpers and persist via
  // provided `opts.persist` when available. Compute-only behavior is still
  // accessible inside this module.
  const toggleStatusAndPersist = async (task: any, lineIndex: number) => {
    const res = await toggleStatus(task, lineIndex);
    if (res && res.newDesc && typeof opts?.persist === 'function') {
      try {
        const isCyclic = Boolean(getCycleType(task));
        const targetDate = !isCyclic
          ? task.date || task.eventDate || (opts?.timeApi && opts.timeApi.currentDate ? opts.timeApi.currentDate.value : '')
          : opts?.timeApi && opts.timeApi.currentDate
            ? opts.timeApi.currentDate.value
            : '';
        const merged: any = { ...task, description: res.newDesc, updatedAt: new Date().toISOString() };
        opts.persist(targetDate, merged as Task);
      } catch (e) {
        // ignore persistence failures
      }
    }
    return res;
  };

  const addAndPersist = async (task: any, text: string) => {
    const res = await add(task, text);
    if (res && res.newDesc && typeof opts?.persist === 'function') {
      try {
        const isCyclic = Boolean(getCycleType(task));
        const targetDate = !isCyclic
          ? task.date || task.eventDate || (opts?.timeApi && opts.timeApi.currentDate ? opts.timeApi.currentDate.value : '')
          : opts?.timeApi && opts.timeApi.currentDate
            ? opts.timeApi.currentDate.value
            : '';
        const merged: any = { ...task, description: res.newDesc, updatedAt: new Date().toISOString() };
        opts.persist(targetDate, merged as Task);
      } catch (e) {
        // ignore persistence failures
      }
    }
    return res;
  };

  return { parsedLines, toggleStatus: toggleStatusAndPersist, add: addAndPersist } as const;
}

export default { construct };
