import { ref, watch } from 'vue';
import type { Ref } from 'vue';
import type { Task } from '../types';

export function createSubtaskLines(activeTask: Ref<Task | null>) {
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

  return { parsedLines } as const;
}
