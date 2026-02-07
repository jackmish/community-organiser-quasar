import { ref, watch } from 'vue';
import type { Ref } from 'vue';
import type { Task } from '../../types';
import type { TaskManager } from '../taskManager';
import { getCycleType } from '../../utlils/occursOnDay';

export class SubtaskLineManager {
  parsedLines: Ref<
    Array<{
      uid: string;
      type: string;
      raw: string;
      html: string;
      checked?: boolean;
      highlighted?: boolean;
    }>
  >;
  // Internal state
  private activeTask: Ref<Task | null>;
  private lastRawLines = ref<string[]>([] as string[]);
  private lastLineUids = ref<string[]>([] as string[]);
  private uidCounter = 1;
  private opts:
    | { time?: any; persist?: (date: string, taskObj: Task) => Promise<void> | void }
    | undefined = undefined;

  constructor(taskManager: TaskManager) {
    let stateOrActiveTask: any = undefined;
    try {
      if (taskManager && typeof taskManager === 'object') {
        stateOrActiveTask = taskManager.apiTask && (taskManager.apiTask.state as any);
        this.opts = {
          time: taskManager.apiTask && taskManager.apiTask.time,
          persist: async (date: string, taskObj: Task) => {
            try {
              if (typeof taskManager.updateTask === 'function') {
                await Promise.resolve(taskManager.updateTask(date, taskObj));
              }
            } catch (e) {
              // ignore persistence failures
            }
          },
        };
      }
    } catch (e) {
      // fall back to undefined state/opts
    }

    if (
      stateOrActiveTask &&
      typeof stateOrActiveTask === 'object' &&
      'activeTask' in stateOrActiveTask
    ) {
      this.activeTask = stateOrActiveTask.activeTask;
    } else if (stateOrActiveTask) {
      this.activeTask = stateOrActiveTask as Ref<Task | null>;
    } else {
      this.activeTask = ref(null) as Ref<Task | null>;
    }

    this.parsedLines = ref([]) as typeof this.parsedLines;

    watch(
      () => this.activeTask.value && this.activeTask.value.description,
      (d) => {
        this.parsedLines.value = this.computeParsedLines(String(d || ''));
      },
      { immediate: true },
    );

    try {
      if (stateOrActiveTask && typeof stateOrActiveTask === 'object') {
        stateOrActiveTask.parsedLines = this.parsedLines;
      }
    } catch (e) {
      // ignore
    }
  }

  private escapeHtml(s = '') {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private escapeRegExp(string = '') {
    return String(string).replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
  }

  private stripTitleFrom(text = '', title = '') {
    if (!text || !title) return text;
    const t = title.trim();
    if (!t) return text;
    const pattern = new RegExp(
      '^\\s*' + this.escapeRegExp(t) + '(?:\\s*[-:—\\|]+\\s*|\\s+|\\s*\\n\\s*)?',
      'i',
    );
    return text.replace(pattern, '');
  }

  private computeParsedLines(desc: string) {
    const d = desc || '';
    if (!d) return [] as typeof this.parsedLines.value;
    const lines = d.split(/\r?\n/);
    const prevMap = new Map<string, string[]>();
    for (let i = 0; i < this.lastRawLines.value.length; i++) {
      const raw = this.lastRawLines.value[i] || '';
      const uid = this.lastLineUids.value[i] || '';
      if (!prevMap.has(raw)) prevMap.set(raw, []);
      prevMap.get(raw)!.push(uid);
    }
    const newUids: string[] = [];
    for (const ln of lines) {
      const raw = ln || '';
      const queue = prevMap.get(raw);
      if (queue && queue.length > 0) {
        const reused = queue.shift();
        newUids.push(reused ?? `line-${this.uidCounter++}`);
      } else {
        newUids.push(`line-${this.uidCounter++}`);
      }
    }
    this.lastRawLines.value = [...lines];
    this.lastLineUids.value = [...newUids];

    return lines.map((ln, lineIndex) => {
      const uid = newUids[lineIndex] ?? `line-${this.uidCounter++}`;
      let text = ln;
      if (lineIndex === 0 && this.activeTask.value?.name) {
        text = this.stripTitleFrom(text, this.activeTask.value.name);
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
        const html = this.escapeHtml(clean).replace(/\n/g, '<br/>');
        return { uid, type: 'list', raw: ln, html, checked, highlighted };
      }
      if (numMatch) {
        const idx = numMatch[1];
        const content = numMatch[2] || '';
        const markerMatch = content.match(/^\s*\[[xX]\]\s*/);
        const checked = !!markerMatch;
        const clean = content.replace(/^\s*\[[xX]\]\s*/, '');
        let html = this.escapeHtml(clean).replace(/\n/g, '<br/>');
        html = `${idx}. ${html}`;
        return { uid, type: 'list', raw: ln, html, checked };
      }
      const html = this.escapeHtml(text).replace(/-vv/g, '✅').replace(/\n/g, '<br/>');
      return { uid, type: 'text', raw: ln, html };
    });
  }

  private async toggleCompute(task: any, lineIndex: number) {
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

  private async addCompute(task: any, text: string) {
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

  async toggleStatusAndPersist(task: any, lineIndex: number) {
    const res = await this.toggleCompute(task, lineIndex);
    if (res && res.newDesc && typeof this.opts?.persist === 'function') {
      try {
        const isCyclic = Boolean(getCycleType(task));
        const targetDate = !isCyclic
          ? task.date ||
            task.eventDate ||
            (this.opts?.time && this.opts.time.currentDate ? this.opts.time.currentDate.value : '')
          : this.opts?.time && this.opts.time.currentDate
            ? this.opts.time.currentDate.value
            : '';
        const merged: Task = {
          ...(task as Task),
          description: res.newDesc,
          updatedAt: new Date().toISOString(),
        };
        const persist = this.opts?.persist;
        if (typeof persist === 'function') {
          try {
            await Promise.resolve(persist(targetDate, merged));
          } catch (e) {
            // ignore persistence failures
          }
        }
      } catch (e) {
        // ignore persistence failures
      }
    }
    return res;
  }

  async addAndPersist(task: any, text: string) {
    const res = await this.addCompute(task, text);
    if (res && res.newDesc && typeof this.opts?.persist === 'function') {
      try {
        const isCyclic = Boolean(getCycleType(task));
        const targetDate = !isCyclic
          ? task.date ||
            task.eventDate ||
            (this.opts?.time && this.opts.time.currentDate ? this.opts.time.currentDate.value : '')
          : this.opts?.time && this.opts.time.currentDate
            ? this.opts.time.currentDate.value
            : '';
        const merged: Task = {
          ...(task as Task),
          description: res.newDesc,
          updatedAt: new Date().toISOString(),
        };
        const persist = this.opts?.persist;
        if (typeof persist === 'function') {
          await Promise.resolve(persist(targetDate, merged));
        }
      } catch (e) {
        // ignore persistence failures
      }
    }
    return res;
  }

  // Public API compatible with previous factory return
  async add(task: any, text: string) {
    return this.addAndPersist(task, text);
  }

  async toggleStatus(task: any, lineIndex: number) {
    return this.toggleStatusAndPersist(task, lineIndex);
  }

  // Provide a compatibility factory
  static construct(taskManager: TaskManager) {
    return new SubtaskLineManager(taskManager);
  }
}

export function construct(taskManager: TaskManager) {
  return SubtaskLineManager.construct(taskManager);
}

export default { construct };
