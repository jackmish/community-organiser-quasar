import type { Task, TaskEmbeddedContact } from '../models/TaskModel';

export const CONTACT_REF_SEP = ':';

export function isContactNoteTask(
  task: { type_id?: string; type?: string; noteMode?: string } | null | undefined,
): boolean {
  const typeId = String(task?.type_id || task?.type || '');
  return typeId === 'NoteLater' && String(task?.noteMode || '') === 'contact';
}

export function isGeneralNoteTask(
  task: { type_id?: string; type?: string; noteMode?: string } | null | undefined,
): boolean {
  const typeId = String(task?.type_id || task?.type || '');
  if (typeId !== 'NoteLater') return false;
  const mode = String(task?.noteMode || 'note');
  return mode === 'note' || mode === 'accounting' || !task?.noteMode;
}

export function makeContactRef(taskId: string, contactId: string): string {
  return `${String(taskId).trim()}${CONTACT_REF_SEP}${String(contactId).trim()}`;
}

export function parseContactRef(ref: string): { taskId: string; contactId: string } | null {
  const raw = String(ref || '').trim();
  const idx = raw.indexOf(CONTACT_REF_SEP);
  if (idx <= 0) return null;
  const taskId = raw.slice(0, idx).trim();
  const contactId = raw.slice(idx + 1).trim();
  if (!taskId || !contactId) return null;
  return { taskId, contactId };
}

function contactStringField(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

export function normalizeEmbeddedContacts(value: unknown): TaskEmbeddedContact[] {
  if (!Array.isArray(value)) return [];
  const out: TaskEmbeddedContact[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const id = contactStringField(row.id);
    const name = contactStringField(row.name);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      name,
      phone: typeof row.phone === 'string' ? row.phone : '',
      email: typeof row.email === 'string' ? row.email : '',
      notes: typeof row.notes === 'string' ? row.notes : '',
    });
  }
  return out;
}

export function normalizeRelatedContactRefs(refs: unknown): string[] {
  if (!Array.isArray(refs)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of refs) {
    const parsed = parseContactRef(String(raw ?? ''));
    if (!parsed || seen.has(String(raw))) continue;
    const ref = makeContactRef(parsed.taskId, parsed.contactId);
    seen.add(ref);
    out.push(ref);
  }
  return out;
}

/** @deprecated legacy task-id links */
export function normalizeRelatedContactIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = String(raw ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function embeddedContactLabel(contact: TaskEmbeddedContact | null | undefined): string {
  return String(contact?.name || '').trim();
}

export function embeddedContactSecondaryLine(
  contact: TaskEmbeddedContact | null | undefined,
): string {
  if (!contact) return '';
  const parts = [contact.phone, contact.email]
    .map((v) => String(v || '').trim())
    .filter(Boolean);
  return parts.join(' · ');
}

export function listContactTasks(tasks: Task[] | null | undefined): Task[] {
  return (tasks || []).filter((t) => {
    if (!isContactNoteTask(t)) return false;
    if (Number(t.status_id) === 0) return false;
    return true;
  });
}

export type LinkableContactEntry = {
  ref: string;
  contact: TaskEmbeddedContact;
  sourceTask: Task;
};

export function listLinkableContacts(tasks: Task[] | null | undefined): LinkableContactEntry[] {
  const out: LinkableContactEntry[] = [];
  for (const task of listContactTasks(tasks)) {
    const taskId = String(task.id ?? '').trim();
    if (!taskId) continue;
    for (const contact of normalizeEmbeddedContacts(task.contacts)) {
      out.push({
        ref: makeContactRef(taskId, contact.id),
        contact,
        sourceTask: task,
      });
    }
  }
  out.sort((a, b) =>
    embeddedContactLabel(a.contact).localeCompare(
      embeddedContactLabel(b.contact),
      undefined,
      { sensitivity: 'base' },
    ),
  );
  return out;
}

export function resolveEmbeddedContacts(
  task: { contacts?: TaskEmbeddedContact[] } | null | undefined,
): TaskEmbeddedContact[] {
  return normalizeEmbeddedContacts(task?.contacts);
}

export function countEmbeddedContacts(
  task: { contacts?: TaskEmbeddedContact[] } | null | undefined,
): number {
  return resolveEmbeddedContacts(task).length;
}

export function countRelatedContactRefs(
  task: { relatedContactRefs?: string[] } | null | undefined,
): number {
  return normalizeRelatedContactRefs(task?.relatedContactRefs).length;
}

export function isGatherContactsEnabled(
  task: { gatherContactsEnabled?: boolean } | null | undefined,
): boolean {
  return !!task?.gatherContactsEnabled;
}

export function countDisplayedContacts(task: Task | null | undefined): number {
  if (!task) return 0;
  if (isContactNoteTask(task)) return countEmbeddedContacts(task);
  if (!isGatherContactsEnabled(task)) return 0;
  return countEmbeddedContacts(task);
}

export function shouldShowContactCountBadge(task: Task | null | undefined): boolean {
  if (!task) return false;
  if (isContactNoteTask(task)) return countEmbeddedContacts(task) > 0;
  return isGatherContactsEnabled(task) && countEmbeddedContacts(task) > 0;
}

export function shouldShowContactToolbarInPreview(task: Task | null | undefined): boolean {
  if (!task) return false;
  if (isContactNoteTask(task)) return countEmbeddedContacts(task) > 0;
  return isGatherContactsEnabled(task) && countEmbeddedContacts(task) > 0;
}

export function resolveRelatedContactEntries(
  task: { relatedContactRefs?: string[] } | null | undefined,
  allTasks: Task[] | null | undefined,
): LinkableContactEntry[] {
  const refs = normalizeRelatedContactRefs(task?.relatedContactRefs);
  if (!refs.length) return [];
  const pool = listLinkableContacts(allTasks);
  const byRef = new Map(pool.map((entry) => [entry.ref, entry]));
  return refs.map((ref) => byRef.get(ref)).filter((entry): entry is LinkableContactEntry => !!entry);
}

export function newEmbeddedContactId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
