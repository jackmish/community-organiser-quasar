<template>
  <q-card
    :class="[
      'q-mb-md task-preview',
      {
        'fixed-preview': props.fixed === true,
        'task-preview--folder-fill': showMediaFolderBrowser && props.fixed !== true,
        'task-preview--note-graphic': showNoteGraphicHero,
      },
    ]"
    :style="previewCardStyle"
  >
    <div class="add-task-group-bar task-preview-group-bar">
      <div class="group-bar-inner">
        <div style="display: inline-block; margin-left: 8px">
          <q-chip
            size="md"
            class="q-pointer group-select-chip"
            clickable
            :style="getGroupChipStyle(activeGroupId)"
            @click.stop="groupMenu = true"
          >
            <q-icon
              :name="getGroupIcon(activeGroupId)"
              :style="{ color: getGroupTextColor(activeGroupId) }"
              class="q-mr-xs"
            />
            {{
              getGroupName(activeGroupId) ||
              groupName ||
              $text("group.none")
            }}
          </q-chip>
          <q-menu
            v-model="groupMenu"
            anchor="bottom right"
            self="top right"
            class="group-menu"
          >
            <q-list dense separator>
              <q-item clickable dense @click="selectGroup(null)">
                <q-item-section
                  side
                  style="
                    width: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  "
                >
                  <q-icon name="clear" />
                </q-item-section>
                <q-item-section>
                  <div style="font-weight: 600">{{ $text("group.none") }}</div>
                </q-item-section>
              </q-item>
              <q-separator />
              <q-item
                v-for="g in groups || []"
                :key="g.id"
                clickable
                dense
                @click="selectGroup(g.id)"
              >
                <q-item-section
                  side
                  style="
                    width: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  "
                >
                  <q-icon
                    :name="g.icon || 'folder'"
                    :style="{ color: g.color || 'inherit' }"
                  />
                </q-item-section>
                <q-item-section>
                  <div style="font-weight: 600">{{ resolveLocalGroupName(g) }}</div>
                </q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </div>
      </div>
    </div>
    <q-card-section class="task-preview__section">
      <div class="row items-start justify-between task-preview__header">
        <div class="task-preview__title-stack">
          <div class="task-preview__title-row">
            <div class="text-h5 task-preview__title">{{ task.name }}</div>
            <q-btn
              dense
              square
              unelevated
              size="sm"
              class="task-preview__priority-btn"
              :class="priorityChipClass(task.priority)"
              :style="priorityChipStyle(task.priority)"
              :icon="(priorityIcons as any)[task.priority] || 'label'"
              :aria-label="String(task.priority || '')"
              :title="String(task.priority || '')"
            >
              <q-menu
                v-model="priorityMenu"
                anchor="bottom right"
                self="top right"
                content-class="priority-menu"
              >
                <q-list style="min-width: 0; padding: 4px 0" dense>
                  <q-item
                    v-for="p in Object.keys(priorityDefinitions)"
                    :key="p"
                    clickable
                    dense
                    @click="selectPriority(p)"
                    :class="['use-default', menuItemClass(p)]"
                    :style="menuItemStyle(p)"
                  >
                    <q-item-section
                      side
                      style="
                        width: 36px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                      "
                    >
                      <q-icon
                        :name="(priorityIcons as any)[p] || 'label'"
                        :color="priorityTextColor(p)"
                      />
                    </q-item-section>
                    <q-item-section>
                      <div :style="{ color: priorityTextColor(p), fontWeight: 600 }">
                        {{ p }}
                      </div>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-btn>
          </div>
          <div
            v-if="showPreviewDatetime"
            class="preview-datetime task-preview__datetime"
          >
            <template v-if="isTodo">
              <span v-if="todoCreatedCaption" class="preview-date preview-date--created">{{
                todoCreatedCaption
              }}</span>
            </template>
            <template v-else>
              <span :class="['preview-date', { insignificant: !isTimeEvent }]">{{
                displayDate
              }}</span>
              <span v-if="task.eventTime" class="preview-time">{{ task.eventTime }}</span>
              <span v-if="eventTimeHoursDisplay" class="text-caption text-grey-6 q-ml-sm">{{
                eventTimeHoursDisplay
              }}</span>
            </template>
          </div>
        </div>
        <div class="task-preview__actions">
          <q-checkbox
            dense
            keep-color
            :model-value="isDone"
            @update:model-value="onToggleDone"
            color="green"
            style="margin-right: 6px"
          />
          <q-btn
            v-if="isMediaFolderTask && mediaRootFolder"
            dense
            round
            unelevated
            color="primary"
            :icon="isMediaGalleryTask ? 'folder_shared' : 'photo_library'"
            :title="
              isMediaGalleryTask
                ? $text('files.switch_to_files_view')
                : $text('files.switch_to_gallery_view')
            "
            :aria-label="
              isMediaGalleryTask
                ? $text('files.switch_to_files_view')
                : $text('files.switch_to_gallery_view')
            "
            @click.stop="void toggleMediaTaskBrowseMode()"
          />
          <q-btn
            v-if="isTodo"
            dense
            round
            unelevated
            color="primary"
            icon="edit_calendar"
            class="todo-schedule-calendar-btn"
            :title="$text('task.todo.schedule_on_calendar')"
            @click.stop="onScheduleTodoClick"
          />
          <q-btn
            v-else-if="hasMeetingScheduleNotes"
            dense
            round
            unelevated
            color="primary"
            icon="event_note"
            class="todo-schedule-calendar-btn"
            :title="$text('task.todo.review_meeting_schedule')"
            @click.stop="onReviewMeetingScheduleClick"
          />
          <q-btn
            dense
            unelevated
            color="orange"
            icon="edit"
            :label="$text('action.edit')"
            @click.stop="$emit('edit')"
          />
          <template v-if="pendingDelete">
            <q-btn
              dense
              unelevated
              color="negative"
              icon="check"
              :title="$text('confirm.delete')"
              @click.stop="confirmDelete"
            />
            <q-btn
              dense
              flat
              round
              icon="close"
              color="grey-7"
              :title="$text('action.cancel')"
              @click.stop="pendingDelete = false"
            />
          </template>
          <q-btn
            v-else
            dense
            flat
            round
            icon="delete"
            color="negative"
            :title="$text('action.delete_task')"
            @click.stop="requestDelete"
          />
          <q-btn dense flat icon="content_copy" @click="copyStyledTask" />
        </div>
      </div>
      <div :class="{ 'task-preview__body': isPreviewBodyFill }">
        <MediaFolderBrowser
          v-if="showMediaFolderBrowser"
          :root-path="mediaRootFolder"
          :images-only="isMediaGalleryTask"
          :gallery-layout="isMediaGalleryTask"
          :gallery-tag-set="galleryTagSet"
          fill-available
        />
        <q-banner
          v-else-if="showMediaFolderMissing"
          dense
          rounded
          class="bg-grey-3 text-grey-9 q-mb-md"
        >
          {{ $text('files.no_task_folder') }}
        </q-banner>

        <div
          v-if="hasMeetingScheduleNotes"
          class="meeting-schedule-preview q-mb-md"
        >
          <div class="text-caption text-weight-bold text-grey-8 q-mb-xs">
            {{ $text('task.todo.meeting_schedule_title') }}
          </div>
          <div
            v-for="row in meetingScheduleRows"
            :key="row.key"
            class="meeting-schedule-preview__row text-body2"
          >
            <span class="meeting-schedule-preview__date">{{ row.dateLabel }}</span>
            <span
              v-if="row.mark"
              class="meeting-schedule-preview__mark text-caption"
              :class="{
                'text-positive': row.mark === 'possible',
                'text-negative': row.mark === 'impossible',
              }"
            >
              ({{
                row.mark === 'possible'
                  ? $text('task.todo.day_mark_possible')
                  : $text('task.todo.day_mark_impossible')
              }})
            </span>
            <div
              v-for="(note, nIdx) in row.notes"
              :key="`${row.key}-note-${nIdx}`"
              class="meeting-schedule-preview__note text-grey-8"
            >
              <q-icon :name="note.icon" size="14px" class="q-mr-xs" />
              <span v-if="note.tagLabel" class="meeting-schedule-preview__note-tag">{{ note.tagLabel }}: </span>
              {{ note.text }}
            </div>
          </div>
        </div>

        <QuickAddSubtaskForm
          v-if="(task.type_id || '') === 'Todo' || (task.type_id || '') === 'TimeEvent'"
          @add="addQuickSubtask"
        />

        <div
          v-if="showNoteGraphicHero && noteGraphicHero"
          class="note-preview-graphic"
        >
          <div
            class="note-preview-graphic__canvas note-preview-graphic__canvas--clickable"
            role="button"
            tabindex="0"
            :title="$text('files.gallery_preview_open')"
            @click="openNoteGraphicPreview(noteGraphicHero)"
            @keydown.enter.prevent="openNoteGraphicPreview(noteGraphicHero)"
            @keydown.space.prevent="openNoteGraphicPreview(noteGraphicHero)"
          >
            <q-img
              :src="noteGraphicHero.dataUrl"
              :alt="noteGraphicHero.name"
              fit="contain"
              class="note-preview-graphic__img"
            />
          </div>
          <div class="note-preview-graphic__footer row items-center no-wrap">
            <div class="note-preview-graphic__name text-body2 ellipsis col">
              {{
                noteGraphicHero.kind === "photo"
                  ? $text("task.note.photo")
                  : noteGraphicHero.name
              }}
            </div>
            <q-btn
              flat
              dense
              round
              icon="folder_open"
              color="primary"
              :title="$text('task.note.open_folder')"
              :aria-label="$text('task.note.open_folder')"
              @click.stop="void revealNoteGraphicItem(noteGraphicHero)"
            />
            <q-btn
              flat
              dense
              color="negative"
              icon="link_off"
              :label="$text('task.note.unlink')"
              @click.stop="unlinkNoteGraphic"
            />
          </div>
          <div
            v-if="hasNoteDescriptionContent"
            class="note-preview-graphic__desc text-body2 q-mt-sm"
            v-html="renderedDescription"
          />
        </div>

        <div
          v-else-if="isNoteTask && hasNoteMedia"
          class="note-preview-media q-mb-md"
        >
          <div v-if="notePhoto" class="note-preview-media__photo q-mb-sm">
            <q-img
              :src="notePhoto"
              ratio="16/9"
              fit="contain"
              class="note-preview-media__photo-img note-preview-media__photo-img--clickable"
              role="button"
              tabindex="0"
              :title="$text('files.gallery_preview_open')"
              @click="openNotePhotoPreview"
              @keydown.enter.prevent="openNotePhotoPreview"
              @keydown.space.prevent="openNotePhotoPreview"
            />
            <div class="row items-center justify-end q-mt-xs q-gutter-xs">
              <q-btn
                flat
                dense
                round
                icon="folder_open"
                color="primary"
                :title="$text('task.note.open_folder')"
                :aria-label="$text('task.note.open_folder')"
                @click.stop="void revealNotePhotoFolder()"
              />
              <q-btn
                flat
                dense
                color="negative"
                icon="link_off"
                :label="$text('task.note.unlink')"
                @click.stop="unlinkNotePhoto"
              />
            </div>
          </div>
          <div v-if="noteAttachments.length" class="note-preview-media__attachments">
            <div
              v-if="noteAttachments.length === 1"
              class="note-preview-media__summary"
            >
              <NoteTaskAttachmentThumb
                v-if="isImageDataUrl(noteAttachments[0]?.dataUrl || '')"
                :task="activeTask"
                :group-id="noteMediaGroupId"
                :task-id="String(activeTask?.id || '')"
                clickable
                @click="onNoteAttachmentsSummaryClick"
                @thumb-loaded="onNoteAttachmentThumbLoaded"
              />
              <div
                class="note-preview-media__file-row"
                @click="onNoteAttachmentClick(0)"
              >
                  <div class="note-preview-media__file-name">
                    {{ noteAttachments[0]?.name }}
                  </div>
                  <q-btn
                    flat
                    dense
                    round
                    icon="folder_open"
                    color="primary"
                    :title="$text('task.note.open_folder')"
                    :aria-label="$text('task.note.open_folder')"
                    @click.stop="void revealNoteAttachmentFolder(0)"
                  />
                  <q-btn
                    flat
                    dense
                    round
                    icon="link_off"
                    color="negative"
                    :title="$text('task.note.unlink')"
                    :aria-label="$text('task.note.unlink')"
                    @click.stop="unlinkNoteAttachment(0)"
                  />
              </div>
            </div>
            <template v-else>
              <div class="note-preview-media__summary q-mb-sm">
                <NoteTaskAttachmentThumb
                  :task="activeTask"
                  :group-id="noteMediaGroupId"
                  :task-id="String(activeTask?.id || '')"
                  clickable
                  @click="onNoteAttachmentsSummaryClick"
                  @thumb-loaded="onNoteAttachmentThumbLoaded"
                />
              </div>
              <div class="note-preview-media__rows">
                <div
                  v-for="(att, idx) in noteAttachments"
                  :key="`${att.name}-${idx}`"
                  class="note-preview-media__file-row"
                  @click="onNoteAttachmentClick(idx)"
                >
                  <div class="note-preview-media__file-name">
                    {{ att.name }}
                  </div>
                  <q-btn
                    flat
                    dense
                    round
                    icon="folder_open"
                    color="primary"
                    :title="$text('task.note.open_folder')"
                    :aria-label="$text('task.note.open_folder')"
                    @click.stop="void revealNoteAttachmentFolder(idx)"
                  />
                  <q-btn
                    flat
                    dense
                    round
                    icon="link_off"
                    color="negative"
                    :title="$text('task.note.unlink')"
                    :aria-label="$text('task.note.unlink')"
                    @click.stop="unlinkNoteAttachment(idx)"
                  />
                </div>
              </div>
            </template>
          </div>
        </div>

        <div v-if="!isInlineMediaFolderPreview && !showNoteGraphicHero">
          <div v-for="(line, idx) in parsedLines" :key="line.uid">
            <div v-if="line.type === 'list'">
              <div
                class="collapse-wrapper"
                :ref="(el) => setItemRef(el, idx)"
                :class="{
                  shrinking:
                    props.animatingLines && props.animatingLines.includes(Number(idx)),
                }"
              >
                <!-- Inline edit mode -->
                <div
                  v-if="editingLineIdx === Number(idx)"
                  class="subtask-edit-row"
                  @click.stop
                >
                  <q-input
                    dense
                    outlined
                    v-model="editingLineText"
                    class="subtask-edit-input"
                    @keydown.enter.prevent="confirmEdit(Number(idx))"
                    @keydown.esc.prevent="cancelEdit"
                    autofocus
                  />
                  <q-btn
                    dense
                    unelevated
                    size="sm"
                    color="positive"
                    icon="check"
                    :title="$text('action.save')"
                    @click.stop="confirmEdit(Number(idx))"
                  />
                  <q-btn
                    dense
                    flat
                    round
                    size="sm"
                    icon="close"
                    color="grey-6"
                    :title="$text('action.cancel')"
                    @click.stop="cancelEdit"
                  />
                </div>
                <!-- Normal view -->
                <q-item
                  v-else
                  clickable
                  :class="[{ highlighted: line.highlighted }, 'q-pa-none']"
                  @click.stop="
                    CC.task.subtaskLine.toggleStatus(
                      CC.task.active.task.value,
                      Number(idx)
                    )
                  "
                >
                  <q-item-section side>
                    <q-icon
                      :name="line.checked ? 'check_circle' : 'radio_button_unchecked'"
                      :color="line.checked ? 'green' : 'grey-6'"
                    />
                  </q-item-section>
                  <q-item-section>
                    <div v-html="line.html"></div>
                  </q-item-section>
                  <q-item-section side class="highlight-section" style="flex-direction: row; gap: 2px; align-items: center;">
                    <template v-if="pendingRemoveIdx === Number(idx)">
                      <q-btn
                        dense
                        unelevated
                        size="sm"
                        color="negative"
                        icon="check"
                        :title="$text('action.confirm_remove')"
                        class="confirm-remove-btn"
                        @click.stop="confirmRemove(Number(idx))"
                      />
                      <q-btn
                        dense
                        flat
                        round
                        size="sm"
                        icon="close"
                        color="grey-5"
                        :title="$text('action.cancel')"
                        @click.stop="pendingRemoveIdx = null"
                      />
                    </template>
                    <template v-else>
                      <q-btn
                        dense
                        flat
                        round
                        size="sm"
                        icon="edit"
                        color="grey-5"
                        class="edit-subtask-btn"
                        :title="$text('action.edit_subtask')"
                        @click.stop="requestEdit(Number(idx), line.raw)"
                      />
                      <q-btn
                        dense
                        flat
                        round
                        size="sm"
                        class="highlight-btn"
                        :icon="highlightIcon"
                        :color="line.highlighted ? 'amber' : 'grey-6'"
                        @click.stop="toggleHighlight(Number(idx))"
                      />
                      <q-btn
                        dense
                        flat
                        round
                        size="sm"
                        icon="delete"
                        color="grey-5"
                        class="remove-subtask-btn"
                        :title="$text('action.remove_subtask')"
                        @click.stop="requestRemove(Number(idx))"
                      />
                    </template>
                  </q-item-section>
                </q-item>
              </div>
            </div>
            <div v-else class="q-mb-xs q-mt-md" v-html="line.html"></div>
          </div>
        </div>
      </div>
    </q-card-section>
  </q-card>

  <MediaGalleryPreviewDialog
    v-if="noteGraphicPreviewEntries.length"
    :open="noteGraphicPreviewOpen"
    :direct-entries="noteGraphicPreviewEntries"
    :direct-entry="noteGraphicPreviewEntry"
    @update:open="onNoteGraphicPreviewOpenChange"
    @update:direct-entry="noteGraphicPreviewEntry = $event"
    @error="onNoteGraphicPreviewError"
  />
</template>

<script setup lang="ts">
import { computed, toRaw, ref, nextTick, watch, onBeforeUnmount } from "vue";
import { useQuasar } from "quasar";
import { $text } from "src/modules/lang";
import type { ComponentPublicInstance } from "vue";
import logger from "src/utils/logger";
import { format } from "date-fns";
import {
  priorityColors,
  priorityTextColor,
  priorityDefinitions,
  priorityIcons,
  highlightIcon,
} from "src/components/theme";
import {
  formatDisplayDate,
  formatEventHoursDiff,
} from "src/modules/task/utils/occursOnDay";
import CC from "src/CCAccess";
import type { Task } from "src/modules/task/models/TaskModel";
import {
  todoCalendarSchedule,
  type DayPlanningSchedule,
  type TodoScheduleTask,
} from "src/composables/useTodoCalendarSchedule";
import {
  PLANNING_NOTE_STATUS_ICONS,
  formatPlanningNoteDisplayText,
  type PlanningNoteStatus,
  type PlanningTag,
} from "src/modules/task/dayPlanning/dayPlanningTypes";
import { normalizePlanningDayEntry, scheduleHasPlanningContent } from "src/modules/task/dayPlanning/dayPlanningUtils";
import QuickAddSubtaskForm from "./QuickAddSubtaskForm.vue";
import NoteTaskAttachmentThumb from "./NoteTaskAttachmentThumb.vue";
import MediaFolderBrowser from "src/modules/media/components/MediaFolderBrowser.vue";
import MediaGalleryPreviewDialog from "src/modules/media/components/MediaGalleryPreviewDialog.vue";
import type { DirectGalleryPreviewEntry } from "src/modules/media/mediaGalleryPreviewTypes";
import { MEDIA_TASK_TYPE } from "src/modules/media/mediaTaskTypes";
import { mediaFlatTasks } from "src/modules/task/managers/taskRepository";
import { isNoteTaskType } from "src/modules/task/utils/calendarTaskTypes";
import {
  collectNoteGraphicItems,
  firstImageTaskAttachment,
  formatNoteTaskCreatedAt,
  isImageDataUrl,
  resolveTaskAttachments,
  resolveTaskPhoto,
  shouldShowNoteGraphicHero,
  stripTitleFromDescription,
  type NoteGraphicItem,
} from "src/modules/task/utils/noteTaskMedia";
import { openNoteAttachmentFile, revealNoteAttachmentFile } from "src/modules/task/utils/noteTaskAttachmentStorage";
import { resolveLocalGroupName } from "src/modules/group/utils/groupLocalNames";
import { getContrastColor } from "src/utils/colorUtils";

const $q = useQuasar();

const props = defineProps<{
  task: Task;
  groupName?: string;
  animatingLines?: number[];
  fixed?: boolean;
}>();
// Prefer the central active task reference from the API. Use this alias
// throughout the component so callers don't need to pass a task prop.
const activeTask = CC.task.active.task;
const emit = defineEmits([
  "edit",
  "close",
  "toggle-status",
  "update-task",
  "delete-task",
  "line-collapsed",
  "line-expanded",
]);

// refs to each rendered list item so we can animate height directly
const itemRefs = ref<Array<HTMLElement | null>>([] as Array<HTMLElement | null>);
const priorityMenu = ref(false);
const groupMenu = ref(false);
const groups = CC.group.list.all;

function getGroupIcon(gid: string | undefined) {
  try {
    const list: any[] = (groups && groups.value) || groups || [];
    if (!gid) return "folder";
    const found = list.find((x: any) => String(x.id) === String(gid));
    return (found && found.icon) || "folder";
  } catch (e) {
    return "folder";
  }
}

function getGroupName(gid: string | undefined) {
  try {
    const list: any[] = (groups && groups.value) || groups || [];
    if (!gid) return null;
    const found = list.find((x: any) => String(x.id) === String(gid));
    return found ? resolveLocalGroupName(found) : null;
  } catch (e) {
    return null;
  }
}

function getGroupChipStyle(gid: string | undefined): Record<string, string> {
  try {
    const list: any[] = (groups && groups.value) || groups || [];
    if (!gid) return {};
    const found = list.find((x: any) => String(x.id) === String(gid));
    if (!found || !found.color) return {};
    const bg = found.color;
    const text =
      found.textColor || found.text_color || getContrastColor(bg);
    return { backgroundColor: bg + " !important", color: text + " !important" };
  } catch (e) {
    return {};
  }
}

function getGroupTextColor(gid: string | undefined): string {
  try {
    const list: any[] = (groups && groups.value) || groups || [];
    if (!gid) return "inherit";
    const found = list.find((x: any) => String(x.id) === String(gid));
    if (!found || !found.color) return "inherit";
    return found.textColor || found.text_color || getContrastColor(found.color);
  } catch (e) {
    return "inherit";
  }
}
// track pending transition fallback timers per element
const transitionFallbacks = new Map<HTMLElement, number>();

async function selectPriority(p: string) {
  try {
    const task = activeTask.value;
    if (!task?.id) return;
    const date =
      (task.date || task.eventDate || CC.task.time.currentDate.value || "").trim();
    if (!date) return;
    await CC.task.update(date, task.id, { priority: p as Task["priority"] });
    const updated =
      CC.task.list.items().find((t) => String(t.id) === String(task.id)) ?? null;
    if (updated && activeTask.value) {
      activeTask.value = updated;
    }
  } catch (e) {
    logger.error("Failed to update task priority", e);
  } finally {
    priorityMenu.value = false;
  }
}

async function selectGroup(gid: string | null) {
  try {
    const updateTask = (...args: any[]) => CC.task.update(...(args as [any, any, any]));
    const date =
      (activeTask.value && (activeTask.value.date || activeTask.value.eventDate)) || "";
    if (!activeTask.value || !activeTask.value.id) return;
    const updates: any = {};
    updates.groupId = gid == null ? undefined : gid;
    await updateTask(date, activeTask.value.id, updates);
    const updated =
      CC.task.list.items().find((t) => String(t.id) === String(activeTask.value?.id)) ?? null;
    if (updated && activeTask.value) {
      activeTask.value = updated;
    }
  } catch (e) {
    logger.error("Failed to update task group", e);
  } finally {
    groupMenu.value = false;
  }
}

function setItemRef(el: Element | ComponentPublicInstance | null, idx: string | number) {
  const i = Number(idx);
  if (el == null) {
    itemRefs.value[i] = null;
    return;
  }
  // If a raw HTMLElement was passed, use it. Otherwise, if a Vue component
  // instance was passed, prefer its $el root DOM node.
  if (el instanceof HTMLElement) {
    itemRefs.value[i] = el;
    return;
  }
  const maybeEl = (el as any)?.$el;
  if (maybeEl && maybeEl instanceof HTMLElement) {
    itemRefs.value[i] = maybeEl;
    return;
  }
  // If we received a generic Element (e.g. SVGElement), coerce as a fallback.
  // This is uncommon but avoids a TS error when refs resolve to Element.
  try {
    const asEl = (el as unknown) as HTMLElement;
    if (asEl && (asEl as any).style !== undefined) {
      itemRefs.value[i] = asEl;
      return;
    }
  } catch (e) {
    void e;
  }
  // fallback
  itemRefs.value[i] = null;
}

function addQuickSubtask(payload: { text: string; starred: boolean }) {
  const lineText = payload.starred ? `${payload.text} *` : payload.text;
  void CC.task.subtaskLine.add(lineText);
  nextTick(() => {
    // parent will re-render after API updates
  });
}

// Remove subtask with inline confirmation
const pendingRemoveIdx = ref<number | null>(null);
let pendingRemoveTimer: ReturnType<typeof setTimeout> | null = null;

function requestRemove(idx: number) {
  pendingRemoveIdx.value = idx;
  if (pendingRemoveTimer) clearTimeout(pendingRemoveTimer);
  pendingRemoveTimer = setTimeout(() => {
    pendingRemoveIdx.value = null;
  }, 2500);
}

function confirmRemove(idx: number) {
  if (pendingRemoveTimer) clearTimeout(pendingRemoveTimer);
  pendingRemoveIdx.value = null;
  void CC.task.subtaskLine.remove(idx);
}

// Edit subtask line inline
const editingLineIdx = ref<number | null>(null);
const editingLineText = ref('');

function extractLineText(raw: string): string {
  const dm = raw.match(/^(\s*-\s*)(\[[xX]\]\s*|\[\s*\]\s*)?(.*)$/);
  if (dm) return (dm[3] ?? '').trim();
  const nm = raw.match(/^(\s*\d+[.)]\s*)(\[[xX]\]\s*|\[\s*\]\s*)?(.*)$/);
  if (nm) return (nm[3] ?? '').trim();
  return raw.trim();
}

function requestEdit(idx: number, raw: string) {
  pendingRemoveIdx.value = null;
  if (pendingRemoveTimer) clearTimeout(pendingRemoveTimer);
  editingLineIdx.value = idx;
  editingLineText.value = extractLineText(raw);
}

function cancelEdit() {
  editingLineIdx.value = null;
  editingLineText.value = '';
}

function confirmEdit(idx: number) {
  const text = editingLineText.value.trim();
  if (text) void CC.task.subtaskLine.update(idx, text);
  cancelEdit();
}

// Delete task with inline confirmation
const pendingDelete = ref(false);
let pendingDeleteTimer: ReturnType<typeof setTimeout> | null = null;

function requestDelete() {
  pendingDelete.value = true;
  if (pendingDeleteTimer) clearTimeout(pendingDeleteTimer);
  pendingDeleteTimer = setTimeout(() => {
    pendingDelete.value = false;
  }, 2500);
}

function confirmDelete() {
  if (pendingDeleteTimer) clearTimeout(pendingDeleteTimer);
  pendingDelete.value = false;
  const t = activeTask.value;
  emit('delete-task', { id: t?.id, date: (t as any)?.date || (t as any)?.eventDate || '' });
}

onBeforeUnmount(() => {
  if (pendingRemoveTimer) clearTimeout(pendingRemoveTimer);
  if (pendingDeleteTimer) clearTimeout(pendingDeleteTimer);
  cancelEdit();
});

// preview card style: 8px blue border to match AddTaskForm style
const previewCardStyle = computed(() => ({
  border: "8px solid #1976d2",
  backgroundColor: "#ffffff",
}));

const priorityColor = (p?: string) => {
  return p ? priorityColors[p] || "grey-4" : "grey-4";
};

const looksLikeCssColor = (s?: string) => !!(s && /^\s*(#|rgb|hsl)/i.test(s));

function priorityChipClass(p?: string) {
  const c = priorityColor(p);
  if (!c) return "";
  return looksLikeCssColor(c) ? "" : `bg-${c}`;
}

function priorityChipStyle(p?: string) {
  const c = priorityColor(p);
  const txt = priorityTextColor(p);
  if (looksLikeCssColor(c)) return { backgroundColor: c, color: txt } as any;
  // If c looks like a Quasar color name (not a raw CSS color), apply only text color
  return { color: txt } as any;
}

function menuItemStyle(p?: string) {
  const c = priorityColor(p);
  const txt = priorityTextColor(p);
  if (!c) return {} as any;
  // Use inline background/color for raw css colors and also set CSS variables
  if (looksLikeCssColor(c))
    return {
      backgroundColor: c,
      color: txt,
      ["--priority-bg"]: c,
      ["--priority-text"]: txt,
    } as any;
  // For Quasar color names we rely on bg-<color> class; still set text color variable
  return { color: txt, ["--priority-text"]: txt } as any;
}

function menuItemClass(p?: string) {
  return priorityChipClass(p);
}

const groupName = computed(() => props.groupName || "");
const activeGroupId = computed(() => activeTask.value?.groupId);

const isTimeEvent = computed(() => (activeTask.value?.type_id || "") === "TimeEvent");
const isTodo = computed(() => (activeTask.value?.type_id || "") === "Todo");
const todoCreatedCaption = computed(() => formatNoteTaskCreatedAt(activeTask.value));
const showPreviewDatetime = computed(() => {
  if (isTodo.value) return true;
  const task = activeTask.value || ({} as Task);
  return !!(task.date || task.eventDate || task.eventTime);
});
const isMediaFilesTask = computed(
  () => (activeTask.value?.type_id || "") === MEDIA_TASK_TYPE.Files,
);
const isMediaGalleryTask = computed(
  () => (activeTask.value?.type_id || "") === MEDIA_TASK_TYPE.Gallery,
);
const isMediaFolderTask = computed(
  () => isMediaFilesTask.value || isMediaGalleryTask.value,
);
const mediaRootFolder = computed(() =>
  String(activeTask.value?.mediaSharedFolderPath || "").trim(),
);
const galleryTagSet = computed(() => activeTask.value?.galleryTagSet ?? null);
const showMediaFolderBrowser = computed(
  () => (isMediaFilesTask.value || isMediaGalleryTask.value) && !!mediaRootFolder.value,
);
const isInlineMediaFolderPreview = computed(
  () => showMediaFolderBrowser.value && props.fixed !== true,
);
const showMediaFolderMissing = computed(
  () => (isMediaFilesTask.value || isMediaGalleryTask.value) && !mediaRootFolder.value,
);

const isNoteTask = computed(() => isNoteTaskType(activeTask.value));
const notePhoto = computed(() => resolveTaskPhoto(activeTask.value));
const noteAttachments = computed(() => resolveTaskAttachments(activeTask.value));
const noteMediaGroupId = computed(() =>
  String(activeTask.value?.groupId || "ungrouped"),
);
const noteGraphicHero = computed(() => collectNoteGraphicItems(activeTask.value)[0] ?? null);
const showNoteGraphicHero = computed(() => shouldShowNoteGraphicHero(activeTask.value));
const hasNoteMedia = computed(
  () => Boolean(notePhoto.value || noteAttachments.value.length),
);
const noteDescriptionPlain = computed(() =>
  stripTitleFromDescription(
    String(activeTask.value?.description || ""),
    String(activeTask.value?.name || ""),
  ).trim(),
);
const hasNoteDescriptionContent = computed(() => noteDescriptionPlain.value.length > 0);
const noteGraphicPreviewOpen = ref(false);
const noteGraphicPreviewEntry = ref<DirectGalleryPreviewEntry | null>(null);
const noteGraphicPreviewEntries = computed((): DirectGalleryPreviewEntry[] =>
  collectNoteGraphicItems(activeTask.value).map((item) => ({
    name: noteGraphicDisplayName(item),
    imageUrl: item.dataUrl,
  })),
);
const isPreviewBodyFill = computed(
  () =>
    (showMediaFolderBrowser.value && props.fixed !== true) || showNoteGraphicHero.value,
);

async function persistNoteMediaUpdate(updates: Record<string, unknown>) {
  const task = activeTask.value;
  if (!task?.id) return;
  const date =
    (task.date || task.eventDate || CC.task.time.currentDate.value || "").trim();
  if (!date) return;
  try {
    await CC.task.update(date, String(task.id), updates);
    const updated =
      CC.task.list.items().find((t) => String(t.id) === String(task.id)) ?? null;
    if (updated) activeTask.value = updated;
  } catch (e) {
    logger.error("Failed to update note media", e);
  }
}

async function unlinkNoteGraphic() {
  const item = noteGraphicHero.value;
  if (!item) return;
  if (item.kind === "photo") {
    await persistNoteMediaUpdate({ photo: "" });
    return;
  }
  if (item.kind === "attachment" && item.attachmentIndex != null) {
    const next = noteAttachments.value.filter((_, i) => i !== item.attachmentIndex);
    await persistNoteMediaUpdate({ attachments: next });
  }
}

async function unlinkNotePhoto() {
  await persistNoteMediaUpdate({ photo: "" });
}

async function unlinkNoteAttachment(index: number) {
  const next = noteAttachments.value.filter((_, i) => i !== index);
  await persistNoteMediaUpdate({ attachments: next });
}

function noteGraphicDisplayName(item: NoteGraphicItem): string {
  return item.kind === "photo" ? $text("task.note.photo") : item.name;
}

function noteGraphicStorageName(item: NoteGraphicItem): string {
  return item.kind === "photo" ? "photo" : item.name;
}

function openNoteGraphicPreview(item: NoteGraphicItem | null | undefined) {
  if (!item || !isImageDataUrl(item.dataUrl)) return;
  noteGraphicPreviewEntry.value = {
    name: noteGraphicDisplayName(item),
    imageUrl: item.dataUrl,
  };
  noteGraphicPreviewOpen.value = true;
}

function openNotePhotoPreview() {
  const photo = notePhoto.value;
  if (!photo || !isImageDataUrl(photo)) return;
  openNoteGraphicPreview({ name: "Photo", dataUrl: photo, kind: "photo" });
}

function openNoteAttachmentPreview(index: number) {
  const att = noteAttachments.value[index];
  if (!att || !isImageDataUrl(att.dataUrl)) return;
  openNoteGraphicPreview({
    name: att.name,
    dataUrl: att.dataUrl,
    kind: "attachment",
    attachmentIndex: index,
  });
}

function noteAttachmentOpenPayload(index: number) {
  const att = noteAttachments.value[index];
  const task = activeTask.value;
  if (!att || !task?.id) return null;
  return {
    groupId: noteMediaGroupId.value,
    taskId: String(task.id),
    name: att.name,
    dataUrl: att.dataUrl,
    ...(att.filePath ? { existingFilePath: att.filePath } : {}),
  };
}

async function persistAttachmentFilePathIfNeeded(index: number, filePath: string) {
  const att = noteAttachments.value[index];
  if (!att || att.filePath === filePath) return;
  const next = [...noteAttachments.value];
  next[index] = { ...att, filePath };
  await persistNoteMediaUpdate({ attachments: next });
}

async function openNoteAttachmentWithSystem(index: number) {
  const payload = noteAttachmentOpenPayload(index);
  if (!payload) return;
  const result = await openNoteAttachmentFile(payload);
  if (!result.ok) {
    $q.notify({
      type: "negative",
      message: result.error || $text("files.open_file"),
    });
    return;
  }
  if (result.filePath) {
    await persistAttachmentFilePathIfNeeded(index, result.filePath);
  }
}

function onNoteAttachmentClick(index: number) {
  const att = noteAttachments.value[index];
  if (!att) return;
  if (isImageDataUrl(att.dataUrl)) {
    openNoteAttachmentPreview(index);
    return;
  }
  void openNoteAttachmentWithSystem(index);
}

function onNoteAttachmentsSummaryClick() {
  const firstImage = firstImageTaskAttachment(activeTask.value);
  if (firstImage) {
    const index = noteAttachments.value.indexOf(firstImage);
    if (index >= 0) {
      openNoteAttachmentPreview(index);
      return;
    }
  }
  if (noteAttachments.value.length >= 1) {
    onNoteAttachmentClick(0);
  }
}

async function onNoteAttachmentThumbLoaded(payload: {
  url: string;
  filePath?: string;
}): Promise<void> {
  if (!payload.filePath) return;
  const firstImage = firstImageTaskAttachment(activeTask.value);
  if (!firstImage || firstImage.filePath === payload.filePath) return;
  const index = noteAttachments.value.findIndex((att) => att === firstImage);
  if (index < 0) return;
  const next = [...noteAttachments.value];
  next[index] = { ...firstImage, filePath: payload.filePath };
  await persistNoteMediaUpdate({ attachments: next });
}

function onNoteGraphicPreviewOpenChange(open: boolean) {
  noteGraphicPreviewOpen.value = open;
  if (!open) noteGraphicPreviewEntry.value = null;
}

function onNoteGraphicPreviewError(message: string) {
  $q.notify({ type: "negative", message });
}

async function revealNoteGraphicItem(item: NoteGraphicItem) {
  const task = activeTask.value;
  if (!task?.id) return;
  const existingFilePath =
    item.kind === "attachment" && item.attachmentIndex != null
      ? noteAttachments.value[item.attachmentIndex]?.filePath
      : undefined;
  const result = await revealNoteAttachmentFile({
    groupId: String(task.groupId || "ungrouped"),
    taskId: String(task.id),
    name: noteGraphicStorageName(item),
    dataUrl: item.dataUrl,
    ...(existingFilePath ? { existingFilePath } : {}),
  });
  if (!result.ok) {
    $q.notify({
      type: "negative",
      message: result.error || $text("task.note.open_folder"),
    });
    return;
  }
  if (
    item.kind === "attachment" &&
    item.attachmentIndex != null &&
    result.filePath &&
    noteAttachments.value[item.attachmentIndex]?.filePath !== result.filePath
  ) {
    const next = [...noteAttachments.value];
    const current = next[item.attachmentIndex];
    if (current) {
      next[item.attachmentIndex] = { ...current, filePath: result.filePath };
      await persistNoteMediaUpdate({ attachments: next });
    }
  }
}

async function revealNotePhotoFolder() {
  const photo = notePhoto.value;
  if (!photo) return;
  await revealNoteGraphicItem({ name: "Photo", dataUrl: photo, kind: "photo" });
}

async function revealNoteAttachmentFolder(index: number) {
  const att = noteAttachments.value[index];
  const task = activeTask.value;
  if (!att || !task?.id) return;
  const result = await revealNoteAttachmentFile({
    groupId: String(task.groupId || "ungrouped"),
    taskId: String(task.id),
    name: att.name,
    dataUrl: att.dataUrl,
    ...(att.filePath ? { existingFilePath: att.filePath } : {}),
  });
  if (!result.ok) {
    $q.notify({
      type: "negative",
      message: result.error || $text("task.note.open_folder"),
    });
    return;
  }
  if (result.filePath && att.filePath !== result.filePath) {
    const next = [...noteAttachments.value];
    next[index] = { ...att, filePath: result.filePath };
    await persistNoteMediaUpdate({ attachments: next });
  }
}

async function toggleMediaTaskBrowseMode(): Promise<void> {
  const task = activeTask.value;
  if (!task?.id || !isMediaFolderTask.value) return;
  const nextType = isMediaGalleryTask.value
    ? MEDIA_TASK_TYPE.Files
    : MEDIA_TASK_TYPE.Gallery;
  try {
    const date =
      (task.date || task.eventDate || CC.task.time.currentDate.value || "").trim() ||
      CC.task.time.currentDate.value ||
      "";
    await CC.task.update(date, String(task.id), { type_id: nextType });
    const updated =
      mediaFlatTasks.value.find((t) => String(t.id) === String(task.id)) ?? null;
    if (updated) activeTask.value = updated;
  } catch (e) {
    logger.error("Failed to toggle media browse mode", e);
  }
}

function onScheduleTodoClick() {
  const t = activeTask.value;
  if (!t) return;
  todoCalendarSchedule.start({
    id: String(t.id),
    name: t.name,
    description: t.description,
    eventTime: t.eventTime,
    eventDate: t.eventDate ?? t.date,
    date: t.date ?? t.eventDate,
    type_id: t.type_id,
    meetingSchedule: t.meetingSchedule ?? t.dayPlanning ?? null,
    dayPlanning: t.dayPlanning ?? t.meetingSchedule ?? null,
    repeat: t.repeat ?? null,
  } as TodoScheduleTask);
  window.dispatchEvent(new Event("co21:todo-schedule-open"));
}

function onReviewMeetingScheduleClick() {
  onScheduleTodoClick();
}

const activeDayPlanning = computed((): DayPlanningSchedule | null | undefined => {
  const t = activeTask.value;
  return (t?.dayPlanning ?? t?.meetingSchedule) as DayPlanningSchedule | null | undefined;
});

const hasMeetingScheduleNotes = computed(() => scheduleHasPlanningContent(activeDayPlanning.value));

const meetingScheduleRows = computed(() => {
  const schedule = activeDayPlanning.value;
  if (!schedule?.days) return [];
  const tags: PlanningTag[] = schedule.tags || [];
  const rows: Array<{
    key: string;
    dateLabel: string;
    mark: "possible" | "impossible" | null;
    notes: Array<{ text: string; status: PlanningNoteStatus; tagLabel: string; icon: string }>;
  }> = [];

  for (const [date, entry] of Object.entries(schedule.days).sort(([a], [b]) => a.localeCompare(b))) {
    const normalized = normalizePlanningDayEntry(entry);
    const mark = normalized.impossible
      ? ("impossible" as const)
      : normalized.possible
        ? ("possible" as const)
        : null;
    const notes = normalized.notes.map((note) => ({
      text: formatPlanningNoteDisplayText(note.text),
      status: note.status,
      tagLabel: tags.find((t) => t.id === note.tagId)?.label || "",
      icon: PLANNING_NOTE_STATUS_ICONS[note.status],
    }));
    if (mark || notes.length) {
      rows.push({
        key: date,
        dateLabel: formatDisplayDate(date),
        mark,
        notes,
      });
    }
  }
  return rows;
});

const displayDate = computed(() => {
  const task = activeTask.value || ({} as any);
  const dateStr = (task.date || task.eventDate || "").toString();
  if (!dateStr) return "";
  return formatDisplayDate(dateStr);
});

const eventTimeHoursDisplay = computed(() => {
  const task = activeTask.value || ({} as any);
  const dateStr = (task.date || task.eventDate || "").toString();
  const timeStr = task.eventTime || "";
  return formatEventHoursDiff(dateStr, timeStr);
});

// Rendered description with simple replacements:
// - replace '[x]' with a check emoji
// - escape HTML, then convert newlines to <br>
function escapeHtml(s = "") {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeRegExp(string = "") {
  return String(string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * If `text` begins with `title` (ignoring case and surrounding whitespace),
 * remove the title and any common separators that follow it (e.g. " - ", ": ", "—", "|", newline).
 */
function stripTitleFrom(text = "", title = "") {
  if (!text || !title) return text;
  const t = title.trim();
  if (!t) return text;
  const pattern = new RegExp(
    "^\\s*" + escapeRegExp(t) + "(?:\\s*[-:—\\|]+\\s*|\\s+|\\s*\\n\\s*)?",
    "i"
  );
  return text.replace(pattern, "");
}

const renderedDescription = computed(() => {
  const stripped = noteDescriptionPlain.value;
  let escaped = escapeHtml(stripped);
  escaped = escaped.replace(/\[x\]/gi, "✅");
  escaped = escaped.replace(/\n/g, "<br/>");
  return escaped;
});

// parsedLines is provided by the central task API so components share the same
// parsed representation and watcher. Use that shared ref here.
const parsedLines = CC.task.subtaskLine.parsedLines;
const isDone = computed(() => Number(activeTask.value?.status_id) === 0);

async function onToggleDone(val: boolean) {
  try {
    const task = activeTask.value;
    if (!task) return;
    const date = task?.date || task?.eventDate || CC.task.time.currentDate.value || "";
    const id = task.id;
    if (!id) return;
    await CC.task.status.toggleComplete(date, id);
  } catch (e) {
    // ignore
  }
}

function toggleHighlight(idx: number) {
  try {
    const parsed = parsedLines.value;
    const item = parsed[idx];
    if (!item || item.type !== "list") return;
    const rawDesc = String(activeTask.value?.description || "");
    const rawLines = rawDesc.split(/\r?\n/);
    // find exact matching raw line
    let foundIdx = rawLines.findIndex((r) => r === (item?.raw || ""));
    // fallback: try loose match by stripping list marker
    if (foundIdx === -1) {
      const stripped = (item?.raw || "").replace(/^\s*[-*]\s*/, "").trim();
      foundIdx = rawLines.findIndex(
        (r) => (r || "").replace(/^\s*[-*]\s*/, "").trim() === stripped
      );
    }
    const newLines = [...rawLines];
    if (item.highlighted) {
      // remove trailing star if present and ensure it does not remain above other starred subtasks
      if (foundIdx >= 0) {
        // compute other starred indices before changing the line
        const otherStarIdxs = newLines
          .map((l, i) => (/\s*\*\s*$/.test(l) ? i : -1))
          .filter((i) => i >= 0 && i !== foundIdx);
        const lastOtherStar = otherStarIdxs.length ? Math.max(...otherStarIdxs) : -1;
        // remove trailing star marker
        newLines[foundIdx] = (newLines[foundIdx] ?? "").replace(/\s*\*\s*$/, "");
        // If this item was above other starred items, move it below the last starred item
        if (lastOtherStar >= 0 && foundIdx < lastOtherStar) {
          const removed = newLines.splice(foundIdx, 1)[0];
          if (removed !== undefined) {
            // after removal, insert at index `lastOtherStar` which accounts for the shift
            newLines.splice(lastOtherStar, 0, removed);
          }
        }
      }
    } else {
      // add star and move to top (after title if present)
      const candidate = (item?.raw || "").replace(/\s*\*\s*$/, "") + " *";
      if (foundIdx >= 0) {
        newLines.splice(foundIdx, 1);
      }
      const title = props.task?.name || "";
      let insertAt = 0;
      if (title && newLines.length > 0) {
        const first = newLines[0] || "";
        const titleMatch = new RegExp("^\\s*" + escapeRegExp(title) + "\\b", "i");
        if (titleMatch.test(first)) insertAt = 1;
      }
      newLines.splice(insertAt, 0, candidate);
    }
    const updated = newLines.join("\n");
    const t = { ...toRaw(activeTask.value), description: updated } as Task;
    emit("update-task", t);
  } catch (e) {
    void e;
  }
}

async function copyStyledTask() {
  const t = toRaw(activeTask.value || ({} as any));
  const html = buildHtmlFromParsed(parsedLines.value, t);
  const text = buildPlainTextFromParsed(parsedLines.value, t);
  try {
    const nav: any = navigator as any;
    if (nav.clipboard && nav.clipboard.write && typeof ClipboardItem !== "undefined") {
      const blobHtml = new Blob([html], { type: "text/html" });
      const blobText = new Blob([text], { type: "text/plain" });
      await nav.clipboard.write([
        new ClipboardItem({ "text/html": blobHtml, "text/plain": blobText }),
      ]);
    } else if (nav.clipboard && nav.clipboard.writeText) {
      await nav.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  } catch (err) {
    logger.error("Copy failed", err);
  }
}

function buildPlainTextFromParsed(
  parsed: Array<{
    type: string;
    raw: string;
    html: string;
    checked?: boolean;
    highlighted?: boolean;
  }>,
  task: any
) {
  const lines: string[] = [];
  // omit title per user request; include date/time only (formatted)
  if (task.date || task.eventTime) {
    try {
      const d = task.date || task.eventDate || "";
      const disp = d ? format(new Date(d), "EEEE, dd.MM.yyyy") : "";
      lines.push(`${disp} ${task.eventTime || ""}`.trim());
    } catch (e) {
      lines.push(`${task.date || ""} ${task.eventTime || ""}`.trim());
    }
  }
  lines.push("");
  for (const item of parsed) {
    if (item.type === "list") {
      let raw = item.raw || "";
      raw = raw.replace(/^\s*[-*]\s*/, "").replace(/^\s*\d+[.)]\s*/, "");
      const checked = !!item.checked || /^\s*\[[xX]\]\s*/.test(item.raw || "");
      const clean = raw.replace(/^\s*\[[xX]\]\s*/, "").trim();
      lines.push(`${checked ? "✔" : "-"} ${clean}`);
    } else {
      const text = (item.raw || "").trim();
      if (text) lines.push(text);
    }
  }
  // omit priority/group per user request
  return lines.join("\n");
}

function buildHtmlFromParsed(
  parsed: Array<{
    type: string;
    raw: string;
    html: string;
    checked?: boolean;
    highlighted?: boolean;
  }>,
  task: any
) {
  const esc = (s = "") =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // use shared `priorityColors` imported from theme
  const parts: string[] = [];
  // overall container; use default font for title (omitted) and smaller font for content
  parts.push('<div style="font-family: Arial, Helvetica, sans-serif; color: #222;">');
  // include only date/time (no title)
  if (task.date || task.eventTime) {
    try {
      const d = task.date || task.eventDate || "";
      const disp = d ? format(new Date(d), "EEEE, dd.MM.yyyy") : "";
      parts.push(
        `<div style="color:#666;font-size:0.9em;margin-bottom:8px;">${esc(disp)} ${esc(
          task.eventTime || ""
        )}</div>`
      );
    } catch (e) {
      parts.push(
        `<div style="color:#666;font-size:0.9em;margin-bottom:8px;">${esc(
          task.date || ""
        )} ${esc(task.eventTime || "")}</div>`
      );
    }
  }
  // Render content using parsed lines; lists get smaller font
  const listItems = parsed.filter((p) => p.type === "list");
  if (listItems.length > 0) {
    parts.push(
      '<ul style="padding-left:18px;margin-top:0;margin-bottom:8px;font-size:13px;line-height:1.4;font-weight:normal;">'
    );
    for (const item of listItems) {
      const checked = !!item.checked || /^\s*\[[xX]\]\s*/.test(item.raw || "");
      parts.push(
        `<li style="margin-bottom:4px;font-weight:normal;">${checked ? "&#x2705; " : ""}${
          item.html
        }</li>`
      );
    }
    parts.push("</ul>");
  } else {
    for (const item of parsed) {
      if (item.type === "text" && item.html && item.html.trim()) {
        parts.push(
          `<p style="margin:0 0 6px 0;font-size:13px;line-height:1.4;font-weight:normal;">${item.html}</p>`
        );
      }
    }
  }
  // omit priority/group per user request
  parts.push("</div>");
  return parts.join("");
}
</script>

<style scoped>
.task-preview {
  position: relative;
  overflow: visible;
}

.task-preview__section {
  position: relative;
}

.task-preview-group-bar.add-task-group-bar {
  position: absolute;
  top: -26px;
  left: 16px;
  right: 16px;
  height: 44px;
  display: flex;
  align-items: center;
  z-index: 6;
  pointer-events: auto;
}

.task-preview-group-bar .group-bar-inner {
  background: transparent;
  backdrop-filter: none;
  padding: 0;
  border-radius: 0;
  display: flex;
  gap: 8px;
  align-items: center;
  box-shadow: none;
}

.task-preview__header {
  margin-bottom: 8px;
}

.task-preview__title-stack {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1 1 auto;
  padding-right: 8px;
}

.task-preview__title-row {
  line-height: 1.25;
}

.task-preview__title {
  display: inline;
}

.task-preview__priority-btn {
  display: inline-flex;
  vertical-align: middle;
  margin-left: 6px;
  width: 28px;
  min-width: 28px;
  height: 28px;
  padding: 0;
}

.task-preview__priority-btn :deep(.q-icon) {
  font-size: 18px;
}

.task-preview__datetime {
  margin-top: 0;
  line-height: 1.2;
}

@media (max-width: 767px) {
  .task-preview__title-stack {
    gap: 0;
  }

  .task-preview__title-row {
    line-height: 1.1;
  }

  .task-preview__title-row .text-h5 {
    margin: 0;
    line-height: 1.1;
  }

  .task-preview__datetime {
    margin-top: 0;
    margin-bottom: 10px;
  }

  .task-preview__header {
    margin-bottom: 0;
  }
}

.task-preview__actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
}

.group-select-chip {
  font-size: 1rem;
  padding: 6px 12px;
  min-width: 120px;
}

.meeting-schedule-preview {
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(25, 118, 210, 0.06);
  border: 1px solid rgba(25, 118, 210, 0.14);
}

.meeting-schedule-preview__row + .meeting-schedule-preview__row {
  margin-top: 8px;
}

.meeting-schedule-preview__date {
  font-weight: 600;
}

.meeting-schedule-preview__mark {
  margin-left: 6px;
}

.meeting-schedule-preview__note {
  margin-top: 2px;
  white-space: pre-wrap;
}
</style>

<style scoped>
.task-preview--note-graphic .task-preview__body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.note-preview-graphic {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.note-preview-graphic__canvas {
  flex: 1 1 auto;
  min-height: 220px;
  max-height: min(68vh, 560px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 8px;
  overflow: hidden;
}

.note-preview-graphic__canvas--clickable {
  cursor: zoom-in;
}

.note-preview-graphic__img {
  width: 100%;
  height: 100%;
  max-height: min(68vh, 560px);
}

.note-preview-graphic__footer {
  gap: 8px;
  margin-top: 8px;
}

.note-preview-graphic__name {
  min-width: 0;
}

.note-preview-graphic__desc {
  white-space: pre-wrap;
  line-height: 1.35;
}

.note-preview-media__photo-img {
  max-width: 100%;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.note-preview-media__photo-img--clickable {
  cursor: zoom-in;
}

.note-preview-media__attachments {
  width: fit-content;
  max-width: none;
}

.note-preview-media__summary {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  width: fit-content;
  max-width: none;
}

.note-preview-media__rows {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px;
  width: fit-content;
  max-width: none;
}

.note-preview-media__file-row {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  width: max-content;
  max-width: none;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(25, 118, 210, 0.08);
  border: 1px solid rgba(25, 118, 210, 0.18);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.note-preview-media__file-row:hover {
  background: rgba(25, 118, 210, 0.12);
  border-color: rgba(25, 118, 210, 0.28);
}

.note-preview-media__file-name {
  flex: 0 0 auto;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
}

.note-preview-media__file-name:hover {
  text-decoration: underline;
}

.shrinking {
  /* marker class for JS-driven collapse; JS handles explicit height/padding/margin animation */
  overflow: hidden;
}

.collapse-wrapper {
  overflow: hidden;
  display: block;
}
.collapse-wrapper {
  transition: max-height 0.25s ease-in-out;
}
</style>

<style scoped>
/* Highlight button: semi-transparent until hover */
.highlight-btn {
  opacity: 0.45;
  transition: opacity 120ms ease;
}
.q-item:hover .highlight-btn {
  opacity: 1;
}
.highlight-section {
  display: flex;
  align-items: center;
  padding-left: 6px;
}
.subtask-edit-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 0;
}
.subtask-edit-input {
  flex: 1;
}
.edit-subtask-btn {
  opacity: 1;
}
.q-item:hover .edit-subtask-btn {
  opacity: 1;
}
/* Highlighted list item visual */
.task-preview .q-item.highlighted {
  background-color: rgba(255, 193, 7, 0.06);
}
</style>

<style scoped>
/* Date larger and blue, time green */
.preview-datetime {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.preview-date {
  color: #1976d2;
  font-size: 1.05rem;
  font-weight: 600;
}
.preview-time {
  color: #2e7d32;
  font-size: 1.05rem;
  font-weight: 600;
  margin-left: 4px;
}

.preview-date.insignificant {
  color: #9e9e9e;
  font-size: 0.85rem;
  font-weight: 400;
}

.preview-date--created {
  color: #757575;
  font-size: 12px;
  font-weight: 400;
}

/* Reduce spacing and line-height for todo subtask list in preview */
.task-preview .q-item {
  padding-top: 4px !important;
  padding-bottom: 4px !important;
  max-height: none;
  min-height: 0 !important;
  height: auto !important;
  box-sizing: border-box;
  overflow: visible;
  transition: none;
}
.task-preview .q-item .q-item-section {
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  min-height: 0 !important;
}
.task-preview .q-item .q-item-section div {
  line-height: 1.15 !important;
  font-size: 13px;
}
.task-preview .q-mb-xs {
  margin-bottom: 6px !important;
  line-height: 1.15 !important;
}

/* Compact priority menu content */
.priority-menu {
  min-width: 0 !important;
  padding: 6px !important;
}
.priority-menu .q-item {
  border-radius: 6px;
  margin: 4px 6px !important;
  padding: 6px 8px !important;
}
.priority-menu .q-item__section {
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}
/* Apply CSS variables when provided (for raw hex/rgb colors). Use !important
   so Quasar's internal backgrounds don't override our swatches. */
.priority-menu .q-item {
  background: var(--priority-bg, transparent) !important;
  color: var(--priority-text, inherit) !important;
}
.priority-menu .q-item__section,
.priority-menu .q-item__label {
  color: var(--priority-text, inherit) !important;
}
/* Global rules for teleported q-menu content (not scoped) */
</style>

<style>
.priority-menu {
  min-width: 0 !important;
  padding: 6px !important;
}
.priority-menu .q-item {
  border-radius: 6px;
  margin: 4px 6px !important;
  padding: 6px 8px !important;
  background: var(--priority-bg, transparent) !important;
  color: var(--priority-text, inherit) !important;
}
.priority-menu .q-item__section,
.priority-menu .q-item__label {
  color: var(--priority-text, inherit) !important;
}
/* Prefer a subtle brighten on hover for priority items, do not apply the global blue overlay. */
/* Ensure we outrank the global menu overlay by using the teleported menu root and body-scoped selector */
body .q-menu.priority-menu .q-item::before,
body .q-menu.priority-menu .q-item.q-item--active::before {
  background: transparent !important;
  background-image: none !important;
}

/* Use a subtle semi-transparent white overlay on hover so the colored background brightens
   instead of being replaced by the global blue overlay. */
body .q-menu.priority-menu .q-item::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background: transparent;
  transition: background-color 140ms ease !important;
  z-index: 0;
}
body .q-menu.priority-menu .q-item:hover::after {
  background: rgba(255, 255, 255, 0.06) !important;
}
body .q-menu.priority-menu .q-item.q-item--active:hover::after {
  background: rgba(255, 255, 255, 0.08) !important;
}

/* Ensure teleported priority menu appears above floating task preview */
.q-menu {
  z-index: 9999992200 !important;
}
</style>

<style>
.task-preview.fixed-preview {
  /* Positioning for floating previews is applied inline via
     `computePreviewStyle(...)`. Avoid hardcoding `position: fixed`
     here so non-floating instances are not forced into fixed layout. */
  z-index: 1600;
  width: 360px;
  /* max-width removed to allow resizing */
  width: auto; /* Optional: Adjust width if needed */
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}
</style>
