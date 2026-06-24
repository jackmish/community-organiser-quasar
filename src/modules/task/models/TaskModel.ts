import { BaseModel } from 'src/types/BaseModel';
import type { MediaGalleryTagSetConfig } from 'src/modules/media/mediaGalleryTagModel';

export type TaskDuration = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type TaskAttachment = {
  name: string;
  dataUrl: string;
  /** Materialized path under app data (desktop). */
  filePath?: string;
};

export class TaskModel extends BaseModel {
  name!: string;
  description!: string;
  // Primary event/due date in YYYY-MM-DD format
  date!: string;
  category!: 'work' | 'personal' | 'meeting' | 'other';
  priority!: 'low' | 'medium' | 'high' | 'critical';
  // Numeric status code for the task lifecycle (e.g. 0 = done, 1 = just created)
  status_id?: number | string | undefined;
  // Type of task, e.g. 'TimeEvent' or 'Todo'
  type_id?: string;
  // Legacy alternative name used in some persisted records
  type?: string;
  // Alternate event date field; some code uses `eventDate` instead of `date`
  eventDate?: string;
  groupId?: string; // Reference to Group
  tags?: string[];
  eventTime?: string; // HH:mm format
  // Canonical repeat settings for cyclic tasks
  repeat?: Record<string, unknown> | null;
  // History of changes for this task
  history?: Array<Record<string, unknown>>;
  // Time mode controls how the event is shown: 'event' (on date),
  // 'prepare' (appear in days-before window), or 'expiration' (appear until done)
  timeMode?: 'event' | 'prepare' | 'expiration' | 'holiday';
  // Number of days before the event when prepare/expiration modes start showing
  timeOffsetDays?: number | null;
  // Optional per-task chosen color set id (e.g. 'set-1'..'set-12')
  color_set?: string | null;
  /** Shared folder path for media/files task types (Files, Gallery). */
  mediaSharedFolderPath?: string;
  /** Per-gallery tag buttons and folder rules (MediaGallery). */
  galleryTagSet?: MediaGalleryTagSetConfig;
  /** Note sub-mode: general note, contact, or accounting (NoteLater). */
  noteMode?: 'note' | 'contact' | 'accounting';
  /** Material icon name for NoteLater tasks. */
  noteIcon?: string;
  /** Accent color hex for NoteLater tasks. */
  noteColor?: string;
  /** Base64 data URL or path for a task photo. */
  photo?: string;
  /** Files attached to a task. */
  attachments?: TaskAttachment[];
  /** Per-day meeting planning notes when scheduling with extended mode. */
  /** Per-day planning data from calendar day-choice mode (tags + notes). */
  dayPlanning?: {
    mode: 'notes';
    tags: Array<{ id: string; label: string }>;
    days: Record<string, {
      possible?: boolean;
      impossible?: boolean;
      notes?: Array<{
        id: string;
        tagId: string;
        text: string;
        status: 'important' | 'tricky' | 'inconvenient' | 'probable';
      }>;
      note?: string;
    }>;
  } | null;
  /** @deprecated use dayPlanning */
  meetingSchedule?: {
    mode: 'notes';
    days: Record<string, { possible?: boolean; impossible?: boolean; note?: string }>;
  } | null;

  constructor(init?: Partial<TaskModel>) {
    super(init);
    if (init) Object.assign(this, init);
  }
}

// Backward-compat alias — prefer `TaskModel` in new code
export { TaskModel as Task };
