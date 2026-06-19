<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { $text } from 'src/modules/lang';
import { formatDisplayDate } from 'src/modules/task/utils/occursOnDay';
import {
  DEFAULT_PLANNING_TAG_ID,
  PLANNING_NOTE_STATUS_COLORS,
  PLANNING_NOTE_STATUS_ICONS,
  formatPlanningNoteDisplayText,
  type PlanningNoteState,
  type PlanningNoteStatus,
} from 'src/modules/task/dayPlanning/dayPlanningTypes';
import {
  orderPlanningNotesForDisplay,
  resolveTaskTypeId,
  type PlanningTagImportTask,
} from 'src/modules/task/dayPlanning/dayPlanningUtils';
import { todoCalendarSchedule } from 'src/composables/useTodoCalendarSchedule';
import TodoPlanningImportTagsDialog from './TodoPlanningImportTagsDialog.vue';
import type { PlanningTag } from 'src/modules/task/dayPlanning/dayPlanningTypes';

const props = defineProps<{
  editingDay: string;
  tasks?: readonly PlanningTagImportTask[];
  /** Mobile/stacked footer: hide inline tag add (use tags dialog). */
  compact?: boolean;
}>();

const expanded = defineModel<boolean>('expanded', { default: true });
const newTagInput = ref('');
const noteInput = ref('');
const noteStatus = ref<PlanningNoteStatus>('probable');
const editingNoteId = ref<string | null>(null);
const editNoteText = ref('');
const editNoteStatus = ref<PlanningNoteStatus>('probable');
const showTagsDialog = ref(false);
const notesListExpanded = ref(false);

const sourceTaskId = computed(() => {
  const id = todoCalendarSchedule.sourceTask.value?.id;
  return id ? String(id) : null;
});

const sourceTypeId = computed(() => {
  const task = todoCalendarSchedule.sourceTask.value;
  if (!task) return 'TimeEvent';
  return resolveTaskTypeId({
    type_id: task.type_id,
    type: typeof task.type === 'string' ? task.type : undefined,
  });
});

const importTasks = computed(() => props.tasks ?? []);

const statusOptions = computed(() =>
  (['important', 'tricky', 'inconvenient', 'probable'] as PlanningNoteStatus[]).map((status) => ({
    value: status,
    icon: PLANNING_NOTE_STATUS_ICONS[status],
    label: $text(`task.todo.planning.status.${status}`),
    color: PLANNING_NOTE_STATUS_COLORS[status],
  })),
);

const dayEntry = computed(() => {
  const d = props.editingDay;
  if (!d) return null;
  return todoCalendarSchedule.dayEntries.value[d] ?? null;
});

const dayNotes = computed((): PlanningNoteState[] => {
  const notes = dayEntry.value?.notes ?? [];
  return orderPlanningNotesForDisplay(notes);
});

const notesListToggleLabel = computed(() => {
  const count = dayNotes.value.length;
  if (count <= 0) return $text('task.todo.planning.show_notes');
  return `${$text('task.todo.planning.show_notes')} (${count})`;
});

watch(
  () => props.editingDay,
  () => {
    editingNoteId.value = null;
    notesListExpanded.value = false;
  },
);

watch(
  () => props.compact,
  (isCompact) => {
    if (isCompact) notesListExpanded.value = false;
  },
);

const addNoteLabel = computed(() =>
  noteInput.value.trim()
    ? $text('task.todo.planning.add_tag')
    : $text('task.todo.planning.mark_day'),
);

const addNoteButtonStyle = computed(() => ({
  backgroundColor: PLANNING_NOTE_STATUS_COLORS[noteStatus.value],
  color: '#fff',
}));

function toggleExpanded() {
  expanded.value = !expanded.value;
}

function toggleNotesList() {
  notesListExpanded.value = !notesListExpanded.value;
  if (!notesListExpanded.value) editingNoteId.value = null;
}

function onAddTag() {
  todoCalendarSchedule.addPlanningTag(newTagInput.value);
  newTagInput.value = '';
}

function onSelectTag(tagId: string) {
  todoCalendarSchedule.setSelectedTagId(tagId);
}

function onAddNote() {
  if (!props.editingDay) return;
  todoCalendarSchedule.addPlanningNote(props.editingDay, noteInput.value, noteStatus.value);
  noteInput.value = '';
}

function isTagSelected(tagId: string): boolean {
  return todoCalendarSchedule.selectedTagId.value === tagId;
}

function statusBtnStyle(status: PlanningNoteStatus, selected: boolean) {
  if (!selected) return {};
  return {
    backgroundColor: PLANNING_NOTE_STATUS_COLORS[status],
    color: '#fff',
  };
}

function startEditNote(note: PlanningNoteState) {
  editingNoteId.value = note.id;
  editNoteText.value = note.text;
  editNoteStatus.value = note.status;
}

function cancelEditNote() {
  editingNoteId.value = null;
}

function confirmEditNote() {
  if (!props.editingDay || !editingNoteId.value) return;
  todoCalendarSchedule.updatePlanningNote(
    props.editingDay,
    editingNoteId.value,
    editNoteText.value,
    editNoteStatus.value,
  );
  editingNoteId.value = null;
}

function onRemoveNote(noteId: string) {
  if (!props.editingDay) return;
  if (editingNoteId.value === noteId) editingNoteId.value = null;
  todoCalendarSchedule.softRemovePlanningNote(props.editingDay, noteId);
}

function onRestoreNote(noteId: string) {
  if (!props.editingDay) return;
  todoCalendarSchedule.restorePlanningNote(props.editingDay, noteId);
}

function onImportTags(tags: PlanningTag[]) {
  todoCalendarSchedule.importPlanningTags(tags);
}
</script>

<template>
  <div class="todo-schedule-day-editor" :class="{ 'todo-schedule-day-editor--compact': compact }">
    <button
      type="button"
      class="todo-schedule-day-editor__head"
      :class="{ 'todo-schedule-day-editor__head--compact': compact }"
      :aria-expanded="expanded"
      :aria-label="compact ? (expanded ? $text('ui.hide') : $text('ui.show')) : undefined"
      @click="toggleExpanded"
    >
      <template v-if="compact">
        <q-icon :name="expanded ? 'expand_less' : 'expand_more'" size="20px" />
      </template>
      <template v-else>
        <span class="todo-schedule-day-editor__head-main">
          <span class="todo-schedule-day-editor__head-date">
            {{ formatDisplayDate(editingDay) }}
          </span>
          <span class="todo-schedule-day-editor__head-note">
            {{ $text('task.todo.planning.head_note') }}
          </span>
        </span>
        <span class="todo-schedule-day-editor__head-toggle">
          {{ expanded ? $text('ui.hide') : $text('ui.show') }}
          <q-icon :name="expanded ? 'expand_less' : 'expand_more'" size="18px" />
        </span>
      </template>
    </button>

    <div v-show="expanded" class="todo-schedule-day-editor__body">
      <div class="todo-schedule-day-editor__columns">
        <div class="todo-schedule-day-editor__col todo-schedule-day-editor__col--tags">
          <div v-if="!compact" class="todo-schedule-day-editor__col-head">
            <div class="todo-schedule-day-editor__col-label">
              {{ $text('task.todo.planning.tags_label') }}
            </div>
            <q-btn
              dense
              flat
              no-caps
              size="sm"
              icon="local_offer"
              color="primary"
              :label="$text('task.todo.planning.import_tags')"
              @click="showTagsDialog = true"
            />
          </div>
          <div class="todo-schedule-day-editor__tags">
            <q-btn
              dense
              no-caps
              unelevated
              class="todo-schedule-day-editor__tag-btn"
              :outline="!isTagSelected(DEFAULT_PLANNING_TAG_ID)"
              :color="isTagSelected(DEFAULT_PLANNING_TAG_ID) ? 'primary' : 'grey-3'"
              :text-color="isTagSelected(DEFAULT_PLANNING_TAG_ID) ? 'white' : 'grey-9'"
              :label="$text('task.todo.planning.default_tag')"
              @click="onSelectTag(DEFAULT_PLANNING_TAG_ID)"
            />
            <q-btn
              v-for="tag in todoCalendarSchedule.planningTags.value"
              :key="tag.id"
              dense
              no-caps
              unelevated
              class="todo-schedule-day-editor__tag-btn"
              :outline="!isTagSelected(tag.id)"
              :color="isTagSelected(tag.id) ? 'primary' : 'grey-3'"
              :text-color="isTagSelected(tag.id) ? 'white' : 'grey-9'"
              :label="tag.label"
              @click="onSelectTag(tag.id)"
            />
          </div>
        </div>

        <div class="todo-schedule-day-editor__col todo-schedule-day-editor__col--add">
          <template v-if="!compact">
            <div class="todo-schedule-day-editor__col-label">
              {{ $text('task.todo.planning.add_person_label') }}
            </div>
            <div class="todo-schedule-day-editor__add-row">
              <q-input
                v-model="newTagInput"
                dense
                outlined
                class="todo-schedule-day-editor__tag-input"
                :placeholder="$text('task.todo.planning.tag_placeholder')"
                @keydown.enter.prevent="onAddTag"
              />
              <q-btn
                dense
                unelevated
                color="primary"
                icon="person_add"
                :label="$text('task.todo.planning.add_tag')"
                class="todo-schedule-day-editor__add-tag-btn"
                @click="onAddTag"
              />
            </div>
          </template>
          <div class="todo-schedule-day-editor__status-row">
            <span
              v-if="!compact"
              class="todo-schedule-day-editor__col-label todo-schedule-day-editor__col-label--inline"
            >
              {{ $text('task.todo.planning.status_label') }}
            </span>
            <div class="todo-schedule-day-editor__status-toolbar">
              <div class="todo-schedule-day-editor__status-buttons">
                <q-btn
                  v-for="opt in statusOptions"
                  :key="opt.value"
                  round
                  unelevated
                  :icon="opt.icon"
                  :color="noteStatus === opt.value ? undefined : 'grey-4'"
                  :text-color="noteStatus === opt.value ? undefined : 'grey-8'"
                  :style="statusBtnStyle(opt.value, noteStatus === opt.value)"
                  class="todo-schedule-day-editor__status-btn"
                  @click="noteStatus = opt.value"
                >
                  <q-tooltip>{{ opt.label }}</q-tooltip>
                </q-btn>
              </div>
              <q-btn
                v-if="compact"
                dense
                no-caps
                unelevated
                icon="local_offer"
                color="primary"
                text-color="white"
                :label="$text('task.todo.planning.tags_button')"
                class="todo-schedule-day-editor__tags-dialog-btn"
                @click="showTagsDialog = true"
              />
            </div>
          </div>
        </div>
      </div>

      <div
        class="todo-schedule-day-editor__note-row"
        :class="{ 'todo-schedule-day-editor__note-row--inline': compact }"
      >
        <q-input
          v-model="noteInput"
          dense
          outlined
          type="textarea"
          autogrow
          class="todo-schedule-day-editor__note"
          :label="compact ? undefined : $text('task.todo.planning.note_label')"
          :placeholder="compact ? $text('task.todo.planning.note_label') : undefined"
          @keydown.ctrl.enter.prevent="onAddNote"
          @keydown.meta.enter.prevent="onAddNote"
        />
        <q-btn
          v-if="compact"
          dense
          round
          unelevated
          icon="note_add"
          class="todo-schedule-day-editor__add-note-btn todo-schedule-day-editor__add-note-btn--icon"
          :style="addNoteButtonStyle"
          :aria-label="addNoteLabel"
          @click="onAddNote"
        >
          <q-tooltip>{{ addNoteLabel }}</q-tooltip>
        </q-btn>
        <template v-else>
          <div class="todo-schedule-day-editor__note-actions-row">
            <q-btn
              dense
              unelevated
              icon="note_add"
              :label="addNoteLabel"
              class="todo-schedule-day-editor__add-note-btn"
              :style="addNoteButtonStyle"
              @click="onAddNote"
            />
          </div>
        </template>
      </div>
      <q-btn
        v-if="compact && dayNotes.length"
        dense
        flat
        no-caps
        :icon="notesListExpanded ? 'expand_less' : 'list'"
        :label="notesListExpanded ? $text('task.todo.planning.hide_notes') : notesListToggleLabel"
        class="todo-schedule-day-editor__notes-toggle-btn"
        @click="toggleNotesList"
      />

      <div
        v-if="dayNotes.length && (!compact || notesListExpanded)"
        class="todo-schedule-day-editor__notes-list"
      >
        <div
          v-for="note in dayNotes"
          :key="note.id"
          class="todo-schedule-day-editor__note-item"
          :class="{ 'todo-schedule-day-editor__note-item--removed': note.pendingRemoval }"
        >
          <template v-if="editingNoteId === note.id && !note.pendingRemoval">
            <div class="todo-schedule-day-editor__note-edit">
              <div class="todo-schedule-day-editor__note-edit-status">
                <q-btn
                  v-for="opt in statusOptions"
                  :key="`edit-${note.id}-${opt.value}`"
                  dense
                  round
                  unelevated
                  :icon="opt.icon"
                  :color="editNoteStatus === opt.value ? undefined : 'grey-4'"
                  :text-color="editNoteStatus === opt.value ? undefined : 'grey-8'"
                  :style="statusBtnStyle(opt.value, editNoteStatus === opt.value)"
                  class="todo-schedule-day-editor__status-btn todo-schedule-day-editor__status-btn--tiny"
                  @click="editNoteStatus = opt.value"
                >
                  <q-tooltip>{{ opt.label }}</q-tooltip>
                </q-btn>
              </div>
              <q-input
                v-model="editNoteText"
                dense
                outlined
                autogrow
                type="textarea"
                class="todo-schedule-day-editor__note-edit-input"
                @keydown.enter.ctrl.prevent="confirmEditNote"
                @keydown.enter.meta.prevent="confirmEditNote"
              />
              <div class="todo-schedule-day-editor__note-edit-actions">
                <q-btn
                  dense
                  round
                  unelevated
                  icon="save"
                  color="primary"
                  :aria-label="$text('action.confirm')"
                  @click="confirmEditNote"
                />
                <q-btn
                  dense
                  round
                  flat
                  icon="close"
                  :aria-label="$text('action.cancel')"
                  @click="cancelEditNote"
                />
              </div>
            </div>
          </template>
          <template v-else>
            <q-icon
              :name="PLANNING_NOTE_STATUS_ICONS[note.status]"
              size="16px"
              :class="`planning-status-icon planning-status-icon--${note.status}`"
            />
            <span v-if="note.tagId !== DEFAULT_PLANNING_TAG_ID" class="todo-schedule-day-editor__note-tag">
              {{
                todoCalendarSchedule.planningTags.value.find((t) => t.id === note.tagId)?.label
              }}
            </span>
            <span
              class="todo-schedule-day-editor__note-text"
              :class="{ 'todo-schedule-day-editor__note-text--placeholder': !note.text?.trim() }"
            >
              {{ formatPlanningNoteDisplayText(note.text) }}
            </span>
            <div class="todo-schedule-day-editor__note-actions">
              <q-btn
                v-if="note.pendingRemoval"
                dense
                flat
                round
                size="sm"
                icon="undo"
                color="primary"
                :label="$text('task.todo.planning.restore_note')"
                class="todo-schedule-day-editor__restore-btn"
                @click="onRestoreNote(note.id)"
              />
              <template v-else>
                <q-btn
                  dense
                  flat
                  round
                  size="sm"
                  icon="edit"
                  color="grey-7"
                  :aria-label="$text('action.edit')"
                  @click="startEditNote(note)"
                />
                <q-btn
                  dense
                  flat
                  round
                  size="sm"
                  icon="delete"
                  color="negative"
                  :aria-label="$text('action.delete')"
                  @click="onRemoveNote(note.id)"
                />
              </template>
            </div>
          </template>
        </div>
      </div>
    </div>

    <TodoPlanningImportTagsDialog
      v-model="showTagsDialog"
      :tasks="importTasks"
      :source-task-id="sourceTaskId"
      :source-type-id="sourceTypeId"
      @import="onImportTags"
    />
  </div>
</template>

<style scoped lang="scss">
.todo-schedule-day-editor {
  display: flex;
  flex-direction: column;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(25, 118, 210, 0.22);
  background: #fff;
  box-shadow:
    0 8px 28px rgba(0, 0, 0, 0.14),
    0 2px 8px rgba(25, 118, 210, 0.12);
}

.todo-schedule-day-editor__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  background: rgba(25, 118, 210, 0.14);
  color: rgba(0, 0, 0, 0.82);
  cursor: pointer;
  text-align: left;
  font: inherit;
}

.todo-schedule-day-editor__head:hover {
  background: rgba(25, 118, 210, 0.2);
}

.todo-schedule-day-editor__head--compact {
  justify-content: center;
  padding: 2px 8px;
  min-height: 28px;
}

.todo-schedule-day-editor--compact .todo-schedule-day-editor__body {
  padding: 8px 10px 10px;
  gap: 8px;
}

.todo-schedule-day-editor__head-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.todo-schedule-day-editor__head-date {
  font-weight: 600;
  font-size: 0.92rem;
}

.todo-schedule-day-editor__head-note {
  font-size: 0.78rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.52);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.todo-schedule-day-editor__head-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.62);
  white-space: nowrap;
}

.todo-schedule-day-editor__body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 12px 12px;
  background: rgba(25, 118, 210, 0.04);
}

.todo-schedule-day-editor__columns {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
}

.todo-schedule-day-editor__col {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.todo-schedule-day-editor__col-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: rgba(0, 0, 0, 0.5);
}

.todo-schedule-day-editor__col-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.todo-schedule-day-editor__col-label--inline {
  text-transform: none;
  letter-spacing: normal;
  font-size: 0.8rem;
}

.todo-schedule-day-editor__tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 8px;
}

.todo-schedule-day-editor__tag-btn {
  width: auto;
  min-height: 38px;
  font-size: 0.92rem;
  font-weight: 600;
  padding: 8px 14px;
}

.todo-schedule-day-editor__add-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
}

.todo-schedule-day-editor__tag-input {
  flex: 1 1 auto;
  min-width: 0;
}

.todo-schedule-day-editor__add-tag-btn {
  flex: 0 0 auto;
  white-space: nowrap;
}

.todo-schedule-day-editor__status-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
}

.todo-schedule-day-editor__status-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
}

.todo-schedule-day-editor__tags-dialog-btn {
  flex: 0 0 auto;
  min-height: 36px;
  padding: 0 12px;
  font-weight: 600;
  font-size: 0.82rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border-radius: 8px;
}

.todo-schedule-day-editor__status-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 0 1 auto;
}

.todo-schedule-day-editor__status-btn {
  width: 36px;
  height: 36px;
  min-width: 36px;
  min-height: 36px;
}

.todo-schedule-day-editor__note-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.todo-schedule-day-editor__note-row--inline {
  flex-wrap: nowrap;
  align-items: center;

  .todo-schedule-day-editor__note {
    flex: 1 1 auto;
    min-width: 0;
  }
}

.todo-schedule-day-editor__add-note-btn--icon {
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  min-width: 36px;
  min-height: 36px;
}

.todo-schedule-day-editor__note {
  flex: 1 1 180px;
  min-width: 0;
}

.todo-schedule-day-editor__add-note-btn {
  flex: 0 0 auto;
  white-space: nowrap;
}

.todo-schedule-day-editor__note-actions-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}

.todo-schedule-day-editor__notes-toggle-btn {
  flex: 0 0 auto;
  white-space: nowrap;
  font-size: 0.78rem;
  align-self: flex-start;
}

.todo-schedule-day-editor__notes-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.todo-schedule-day-editor__note-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 0.82rem;
  line-height: 1.35;
  padding: 4px 2px;
  border-radius: 6px;
}

.todo-schedule-day-editor__note-item--removed {
  opacity: 0.55;
  background: rgba(0, 0, 0, 0.04);

  .todo-schedule-day-editor__note-text {
    text-decoration: line-through;
  }
}

.todo-schedule-day-editor__note-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
  flex: 0 0 auto;
}

.todo-schedule-day-editor__restore-btn {
  font-size: 0.72rem;
  min-height: 28px;
  padding: 0 8px;
}

.todo-schedule-day-editor__note-edit {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 6px;
  width: 100%;
}

.todo-schedule-day-editor__note-edit-status {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
  width: 100%;
}

.todo-schedule-day-editor__status-btn--tiny {
  width: 28px;
  height: 28px;
  min-width: 28px;
  min-height: 28px;
}

.todo-schedule-day-editor__note-edit-input {
  flex: 1 1 140px;
  min-width: 0;
}

.todo-schedule-day-editor__note-edit-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex: 0 0 auto;
}

.todo-schedule-day-editor__note-tag {
  font-weight: 600;
  color: rgba(0, 0, 0, 0.62);
}

.todo-schedule-day-editor__note-text {
  flex: 1;
  white-space: pre-wrap;
  word-break: break-word;
}

.todo-schedule-day-editor__note-text--placeholder {
  color: rgba(0, 0, 0, 0.45);
  font-style: italic;
  letter-spacing: 0.06em;
}

.planning-status-icon--important {
  color: #c62828;
}

.planning-status-icon--tricky {
  color: #6a1b9a;
}

.planning-status-icon--inconvenient {
  color: #ef6c00;
}

.planning-status-icon--probable {
  color: #2e7d32;
}

@media (max-width: 520px) {
  .todo-schedule-day-editor__columns {
    grid-template-columns: 1fr;
  }
}
</style>
