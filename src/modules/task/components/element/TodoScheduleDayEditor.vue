<script setup lang="ts">
import { computed, ref } from 'vue';
import { $text } from 'src/modules/lang';
import { formatDisplayDate } from 'src/modules/task/utils/occursOnDay';
import {
  DEFAULT_PLANNING_TAG_ID,
  PLANNING_NOTE_STATUS_COLORS,
  PLANNING_NOTE_STATUS_ICONS,
  formatPlanningNoteDisplayText,
  type PlanningNoteStatus,
} from 'src/modules/task/dayPlanning/dayPlanningTypes';
import { todoCalendarSchedule } from 'src/composables/useTodoCalendarSchedule';

const props = defineProps<{
  editingDay: string;
}>();

const expanded = ref(true);
const newTagInput = ref('');
const noteInput = ref('');
const noteStatus = ref<PlanningNoteStatus>('probable');

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

const dayNotes = computed(() => dayEntry.value?.notes ?? []);

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
</script>

<template>
  <div class="todo-schedule-day-editor">
    <button
      type="button"
      class="todo-schedule-day-editor__head"
      :aria-expanded="expanded"
      @click="toggleExpanded"
    >
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
    </button>

    <div v-show="expanded" class="todo-schedule-day-editor__body">
      <div class="todo-schedule-day-editor__columns">
        <div class="todo-schedule-day-editor__col todo-schedule-day-editor__col--tags">
          <div class="todo-schedule-day-editor__col-label">
            {{ $text('task.todo.planning.tags_label') }}
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
          <div class="todo-schedule-day-editor__status-row">
            <span class="todo-schedule-day-editor__col-label todo-schedule-day-editor__col-label--inline">
              {{ $text('task.todo.planning.status_label') }}
            </span>
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
          </div>
        </div>
      </div>

      <div class="todo-schedule-day-editor__note-row">
        <q-input
          v-model="noteInput"
          dense
          outlined
          type="textarea"
          autogrow
          class="todo-schedule-day-editor__note"
          :label="$text('task.todo.planning.note_label')"
          @keydown.ctrl.enter.prevent="onAddNote"
          @keydown.meta.enter.prevent="onAddNote"
        />
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

      <div v-if="dayNotes.length" class="todo-schedule-day-editor__notes-list">
        <div
          v-for="note in dayNotes"
          :key="note.id"
          class="todo-schedule-day-editor__note-item"
        >
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
        </div>
      </div>
    </div>
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

.todo-schedule-day-editor__status-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
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

.todo-schedule-day-editor__note {
  flex: 1 1 180px;
  min-width: 0;
}

.todo-schedule-day-editor__add-note-btn {
  flex: 0 0 auto;
  white-space: nowrap;
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
