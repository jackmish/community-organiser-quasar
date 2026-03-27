<template>
  <q-page class="q-pa-md">
    <!-- top selector removed; groups shown in the header -->

    <!-- Loading State -->
    <div
      v-if="CC.storage.isLoading && CC.storage.isLoading.value"
      class="text-center q-pa-lg"
    >
      <q-spinner color="primary" size="3em" />
    </div>
    <!-- Single TaskPreview instance: when `previewFloating` is true it will be positioned
         near the clicked task by applying an inline fixed-position style; otherwise it
         stays inside the fixed-right-panel as before. This avoids rendering two copies. -->
    <div v-else>
      <div class="row q-col-gutter-md tasks-row">
        <div class="col-12 left-panel tasks-column" style="position: relative">
          <q-card class="task-list-card" :style="cardStyle">
            <q-card-section>
              <div class="text-h6 task-list-header" :style="headerStyle">
                <div
                  class="row items-center justify-between"
                  style="align-items: center; margin-top: 6px; justify-content: flex-end"
                >
                  <div class="row items-center" style="gap: 8px">
                    <q-btn flat dense round @click="CC.task.time.prevDay">
                      <q-icon
                        name="chevron_left"
                        :style="'color: ' + headerStyle.color + ' !important;'"
                      />
                    </q-btn>

                    <span
                      :class="[
                        'text-weight-bold',
                        getTimeDiffClass(CC.task.time.currentDate.value),
                      ]"
                      :style="'color: ' + headerStyle.color + ' !important;'"
                      >{{ formatDateOnly(CC.task.time.currentDate.value) }}</span
                    >
                    <q-btn flat dense round @click="CC.task.time.nextDay">
                      <q-icon
                        name="chevron_right"
                        :style="'color: ' + headerStyle.color + ' !important;'"
                      />
                    </q-btn>
                  </div>
                  <!-- Insert today's full date/time near the task list header (swapped from main header) -->
                  <div
                    style="
                      display: flex;
                      align-items: center;
                      gap: 8px;
                      position: relative;
                    "
                  >
                    <GroupSelectHeader />
                  </div>
                </div>
              </div>
              <Watermark
                :active-group="CC.group.active.activeGroup"
                :color="watermarkTextColor"
                size="large"
                justifyContent="flex-start"
              />
            </q-card-section>
            <q-card-section v-if="sortedTasks.length === 0">
              <p class="text-grey-6">{{ $text("ui.no_tasks_for_day") }}</p>
            </q-card-section>

            <!-- hidden groups are rendered inside TasksListSmall now | Maybe it would be available to switch inside app to TasksListMedium in the future -->
            <TasksListSmall
              :key="reloadKey"
              :tasks-with-time="tasksWithTime"
              :tasks-without-time="tasksWithoutTime"
              :hidden-groups="hiddenGroupSummary.groups"
              :replenish-tasks="replenishTasks"
              :selected-task-id="selectedTaskId"
              @task-click="onTaskClicked"
              @task-context="handleTaskContext"
              @edit-task="editTask"
              @delete-task="handleDeleteTask"
              @toggle-status="handleToggleStatus"
              @add-task="onInlineAdd"
            />
          </q-card>

          <!-- Parent-level add button to sit above list without z-index hacks -->
          <q-btn
            v-show="panelHidden || !previewFloating"
            class="list-add-btn"
            color="positive"
            unelevated
            aria-label="Add task"
            @click="onListAdd"
          >
            <q-icon name="add" />
          </q-btn>
        </div>
      </div>

      <div class="row q-col-gutter-md q-mt-md">
        <div class="col-12 col-md-8">
          <CalendarView
            :key="reloadKey"
            :selected-date="CC.task.time.currentDate.value"
            :tasks="allTasks"
            @update:selectedDate="(d) => CC.task.time.setCurrentDate(d)"
            @day-click="onCalendarDayClick"
          />
        </div>
        <div class="col-12 col-md-4">
          <div class="q-mb-md">
            <DoneTasksList :done-tasks="doneTasks" />
            <PluginSlot name="below-done-list" />
          </div>
        </div>
      </div>
    </div>

    <!-- Group Management Dialog -->
    <GroupManagementDialog
      v-model="showGroupDialog"
      :group-options="groupOptions"
      :group-tree="groupTree"
    />
    <!-- Group Edit Dialog (opened from options menu) -->
    <GroupEditDialog
      v-model="showGroupEditDialog"
      :editing-group-id="editDialogGroupId"
    />
    <!-- Join Member Dialog (opened from options menu 'Join new member or device') -->
    <JoinMemberDialog v-model="showCommunityDialog" />
    <!-- First Run Dialog -->
    <FirstRunDialog
      v-model="showFirstRunDialog"
      @create="handleFirstGroupCreation"
      @import="handleImportFile"
    />

    <div :class="['fixed-right-panel', { 'panel-hidden': panelHidden }]">
      <div
        class="fixed-content"
        :class="{ floating: previewFloating }"
        :style="previewFloating ? computePreviewStyle(previewRect) : {}"
      >
        <q-btn
          v-if="!panelHidden"
          unelevated
          color="dark"
          class="panel-toggle-btn"
          :label="$text('ui.hide')"
          icon="keyboard_arrow_down"
          @click="panelHidden = true"
        />

        <!-- Single TaskPreview instance: toggles between floating and fixed placement -->
        <TaskPreview
          v-if="CC.task.active.mode.value === 'preview' && CC.task.active.task.value"
          :task="CC.task.active.task.value"
          :group-name="getGroupName(CC.task.active.task.value.groupId)"
          :animating-lines="animatingLines"
          @line-collapsed="onLineCollapsed"
          @line-expanded="onLineExpanded"
          @edit="
            () => {
              CC.task.active.mode.value = 'edit';
            }
          "
          @close="clearTaskToEdit"
          @update-task="(t) => handleUpdateTask(t)"
          :fixed="previewFloating"
        />

        <div
          class="floating-preview-wrapper"
          :class="{ floating: previewFloating }"
          v-if="
            CC.task.active.mode.value === 'add' || CC.task.active.mode.value === 'edit'
          "
        >
          <AddTaskForm
            :filtered-parent-options="filteredParentOptions"
            :active-group="CC.group.active.activeGroup.value"
            :show-calendar="false"
            :selected-date="newTask.eventDate"
            :all-tasks="allTasks"
            :replenish-tasks="replenishTasks"
            :initial-task="CC.task.active.task.value"
            :mode="CC.task.active.mode.value"
            @update:mode="(v) => CC.task.active.setMode(v)"
            @add-task="handleAddTask"
            @update-task="handleUpdateTask"
            @delete-task="handleDeleteTask"
            @toggle-status="handleToggleStatus"
            @cancel-edit="() => clearTaskToEdit()"
            @calendar-date-select="handleCalendarDateSelect"
            @filter-parent-tasks="filterParentTasks"
          />
        </div>
      </div>
    </div>

    <!-- Floating Add button: appears in edit/preview or when panel is hidden -->
    <q-btn
      v-if="panelHidden || CC.task.active.mode.value !== 'add'"
      class="floating-add-btn"
      color="green"
      fab
      icon="add"
      dense
      @click="onFloatingAddClick"
      :title="$text('ui.add_new_task')"
    />
    <!-- Show button visible when the panel is hidden and a task is selected (edit/preview) -->
    <q-btn
      v-if="panelHidden && CC.task.active.mode.value !== 'add'"
      class="panel-show-btn"
      unelevated
      color="dark"
      icon="keyboard_arrow_up"
      :label="$text('ui.show')"
      @click="panelHidden = false"
    />
  </q-page>
</template>

<script setup lang="ts">
import { todayString } from "src/utils/dateUtils";
import { createImportHandler } from "src/modules/storage/handlers/importHandlers";
import { useDayRollover } from "src/composables/useDayRollover";

import AddTaskForm from "src/modules/task/components/element/AddTaskForm.vue";
import Watermark from "src/components/ui/Watermark.vue";

import DoneTasksList from "src/modules/task/components/list/DoneTasksList.vue";
import PluginSlot from "../components/ui/PluginSlot.vue";
import GroupManagementDialog from "src/modules/group/components/GroupManagementDialog.vue";
import GroupEditDialog from "src/modules/group/components/GroupEditDialog.vue";
import JoinMemberDialog from "src/components/settings/JoinMemberDialog.vue";

import { formatDisplayDate } from "src/modules/task/utils/occursOnDay";
import TaskPreview from "src/modules/task/components/element/TaskPreview.vue";
import CalendarView from "src/components/time/CalendarView.vue";
import GroupSelectHeader from "src/modules/group/components/GroupSelectHeader.vue";
import { useDayOrganiserView } from "src/composables/useDayOrganiserView";
import { useGroupColor } from "src/composables/useGroupColor";
import { createLineEventHandlers } from "src/modules/task/handlers/lineEventHandlers";
import { createTaskUiHandlers } from "src/modules/task/handlers/taskUiHandlers";
import { createTaskViewHelpers } from "src/modules/task/helpers/taskViewHelpers";
import { createCalendarHandlers } from "src/modules/task/handlers/calendarHandlers";
import { createTaskComputed } from "src/modules/task/computed/computedTaskLists";
import { createTaskCrudHandlers } from "src/modules/task/handlers/taskCrudHandlers";
import TasksListSmall from "src/modules/task/components/list/TasksListSmall.vue";

// Use shared view composable for clock and time-diff helpers
const { now, getTimeDifferenceDisplay, getTimeDiffClass } = useDayOrganiserView();

// calendar handlers will be provided by createCalendarHandlers (instantiated after refs)

import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from "vue";
import { $text } from "src/modules/lang";
import { useFloatingPreview } from "src/composables/useFloatingPreview";
import { useQuasar } from "quasar";
import logger from "src/utils/logger";
import CC from "src/CentralController";

import { createHiddenGroupSummary } from "src/modules/task/helpers/hiddenGroupSummary";
import type { Group } from "src/modules/group/models/GroupModel";
import FirstRunDialog from "../components/settings/FirstRunDialog.vue";

const $q = useQuasar();

const currentDayData = computed(() => {
  const days = CC.task.time.days.value || {};
  const d = CC.task.time.currentDate.value;
  return days[d] || ({ date: d, tasks: [], notes: "" } as any);
});

async function onTaskClicked(task: any, rect?: DOMRect | null) {
  try {
    const activeId = CC.task.active.task.value?.id;
    if (
      activeId &&
      task &&
      String(activeId) === String(task.id) &&
      previewFloating.value
    ) {
      // second click on same task -> return preview to default place
      previewFloating.value = false;
      previewRect.value = null;
      return;
    }
    // Delegate to existing handler which sets preview task and mode
    try {
      handleTaskClick(task);
    } catch (e) {
      try {
        // fallback: use CC directly
        CC.task.active.setTask(task);
        CC.task.active.mode.value = "preview";
      } catch (err) {
        void err;
      }
    }
    // If we received a bounding rect, wait for DOM to render then show floating preview near it
    if (rect) {
      await nextTick();
      // wait for layout to settle
      await new Promise((r) => requestAnimationFrame(r));
      // try to find the task element again (in case DOM reflow changed position)
      try {
        const selector = `[data-task-id="${task?.id}"]`;
        const el = document.querySelector(selector);
        let newRect: DOMRect | null = null;
        if (el instanceof Element) newRect = el.getBoundingClientRect();
        else newRect = rect ?? null;
        setPreviewFloating(newRect, { forceBelow: true });
      } catch (e) {
        // Prefer below placement for add-button anchored floating form by passing { forceBelow: true } to setPreviewFloating.
        // Use universal anchor helper when available.
        try {
          // If composable exported `anchorTo`, prefer it; fall back to setPreviewFloating
          const maybeAnchor = (useFloatingPreview as any).__anchorTo;
          if (typeof maybeAnchor === "function") {
            // not used: maintain compatibility
          }
        } catch (e) {
          void e;
        }
        setPreviewFloating(rect, { forceBelow: true });
      }
    } else {
      // clear floating placement
      // clear floating placement
      setPreviewFloating(null);
    }
  } catch (e) {
    void e;
  }
}

async function handleTaskContext(task: any, rect?: DOMRect | null) {
  try {
    // handleTaskContext start
    // Try selecting by id first so ApiTask resolves the canonical object
    const id = task && (task.id ?? task);
    try {
      // If we can resolve the canonical object from the task list, use
      // that immediately so form bindings point to the same instance.
      let candidate: any = task;
      try {
        const all = CC.task.list.all();
        const found = (all || []).find((t: any) => String(t.id) === String(id));
        if (found) candidate = found;
      } catch (e) {
        // ignore lookup failures
      }

      // If the emitted payload was undefined but we have a bounding rect,
      // try to resolve the task id from the DOM element at the rect center
      // (useful when the emitter lost the item reference).
      if ((candidate === undefined || candidate === null) && rect) {
        try {
          const cx = rect.left + (rect.width || 0) / 2;
          const cy = rect.top + (rect.height || 0) / 2;
          const el = document.elementFromPoint(cx, cy);
          let cur: Element | null = el;
          while (cur && !cur.hasAttribute?.("data-task-id")) cur = cur.parentElement;
          const dataId = cur?.getAttribute?.("data-task-id") || null;
          if (dataId) {
            try {
              const all = CC.task.list.all();
              const found2 = (all || []).find(
                (t: any) => String(t.id) === String(dataId)
              );
              if (found2) candidate = found2;
              else {
                // fallback to using dataId as id
                // leave candidate null so we can try id-based setTask below
              }
              // resolved id from DOM: dataId
            } catch (e) {
              // ignore
            }
          }
        } catch (e) {
          // ignore DOM lookup errors
        }
      }

      // setting task candidate
      let setSucceeded = false;
      try {
        if (candidate != null) {
          CC.task.active.setTask(candidate);
          setSucceeded = true;
        } else if (id != null) {
          CC.task.active.setTask(id);
          setSucceeded = true;
        } else {
          // no candidate or id to set
        }
      } catch (e) {
        setSucceeded = false;
      }

      if (setSucceeded) {
        try {
          CC.task.active.setMode("edit");
          panelHidden.value = false;
        } catch (e) {
          // ignore
        }
      }

      // after setTask
    } catch (e) {
      void e;
    }

    // Wait for reactivity to settle; if active task wasn't resolved (ApiTask
    // may not have found it in `flatTasks`), try to find the canonical
    // object in the task list and set that instead.
    await nextTick();
    await new Promise((r) => requestAnimationFrame(r));
    try {
      const activeId = CC.task.active.task.value?.id;
      if (
        !activeId ||
        String(activeId) !== String(id) ||
        CC.task.active.mode.value !== "edit"
      ) {
        try {
          const all = CC.task.list.all();
          const found = (all || []).find((t: any) => String(t.id) === String(id));
          if (found) {
            CC.task.active.setTask(found);
            CC.task.active.setMode("edit");
            panelHidden.value = false;
          }
        } catch (e) {
          void e;
        }
      }
    } catch (e) {
      void e;
    }

    // If we received a bounding rect, show floating editor near it
    if (rect) {
      await nextTick();
      await new Promise((r) => requestAnimationFrame(r));
      try {
        const selector = `[data-task-id="${id}"]`;
        const el = document.querySelector(selector);
        let newRect: DOMRect | null = null;
        if (el instanceof Element) newRect = el.getBoundingClientRect();
        else newRect = rect ?? null;
        setPreviewFloating(newRect, { forceBelow: true });
      } catch (e) {
        setPreviewFloating(rect, { forceBelow: true });
      }
    } else {
      setPreviewFloating(null);
    }
  } catch (e) {
    void e;
  }
}

// Provide a lightweight organiser-like ref for legacy helpers that expect
// an `organiserData` ref with `groups` and `days`.
const organiserLike = computed(() => ({
  groups: CC.group.list.all.value,
  days: CC.task.time.days.value,
}));

const hiddenGroupSummary = createHiddenGroupSummary(
  organiserLike as any,
  CC.group.active.activeGroup
);

// All tasks across days — used to render calendar events
const allTasks = computed(() => CC.task.list.all());

// `hiddenGroupSummary` moved to the day-organiser module for reuse

const showGroupDialog = ref(false);
const showGroupEditDialog = ref(false);
const editDialogGroupId = ref<string | null>(null);
// reset edit group id whenever that dialog is closed
watch(showGroupEditDialog, (v) => {
  if (!v) editDialogGroupId.value = null;
});
const showCommunityDialog = ref(false);

// Inline edit-group dialog removed (unused)
const showFirstRunDialog = ref(false);

const defaultGroupId = ref<string | undefined>(undefined);
const openDeleteMenu = ref<string | null>(null);
// when true the fixed panel is moved off-screen (hidden) and only the show button is visible
const panelHidden = ref(false);
const selectedTaskId = computed(() => CC.task.active.task.value?.id ?? null);
const reloadKey = ref(0);
const animatingLines = ref<number[]>([]);
// child line animation handlers (API handles the data changes)
const { onLineCollapsed, onLineExpanded } = createLineEventHandlers();

// task UI handlers moved to module
const { setTaskToEdit, editTask, clearTaskToEdit } = createTaskUiHandlers({
  activeTask: CC.task.active.task,
  activeMode: CC.task.active.mode,
  setActiveTask: (p: Parameters<typeof CC.task.active.setTask>[0]) =>
    CC.task.active.setTask(p),
  panelHidden,
  currentDate: CC.task.time.currentDate,
});

// outer-scope handlers for window events (registered/assigned inside onMounted)
let organiserReloadHandler: any = null;

const { handleImportFile } = createImportHandler({
  storage: CC.storage,
  quasar: $q,
  reloadKey,
  showFirstRunDialog,
});
let organiserGroupManageHandler: any = null;
let organiserGroupManageEditHandler: any = null;
let organiserCommunityOpenHandler: any = null;

// Register cleanup synchronously during setup so lifecycle hook is valid
onBeforeUnmount(() => {
  try {
    if (organiserReloadHandler)
      window.removeEventListener(
        "organiser:reloaded",
        organiserReloadHandler as EventListener
      );
    if (organiserGroupManageHandler)
      window.removeEventListener(
        "group:manage",
        organiserGroupManageHandler as EventListener
      );
    if (organiserGroupManageEditHandler)
      window.removeEventListener(
        "group:manage-edit",
        organiserGroupManageEditHandler as EventListener
      );
    if (organiserCommunityOpenHandler)
      window.removeEventListener(
        "community:open",
        organiserCommunityOpenHandler as EventListener
      );
  } catch (e) {
    // ignore
  }
});

// Ensure we return to 'add' mode when no task is selected
watch(
  () => CC.task.active.task.value,
  (val) => {
    if (!val && CC.task.active.mode.value !== "add") {
      CC.task.active.mode.value = "add";
    }
  }
);

// When the current date changes (via calendar or prev/next arrows), switch to creation mode
watch(
  () => CC.task.time.currentDate.value,
  (newDate, oldDate) => {
    try {
      if (newDate !== oldDate) {
        // Defer check so other date-change handlers (e.g. calendar preview) run first.
        setTimeout(() => {
          try {
            // Determine if the selected date has any tasks
            const all =
              CC.task.list && typeof CC.task.list.all === "function"
                ? CC.task.list.all()
                : [];
            const tasksOnDate = (all || []).filter((t: any) => {
              const d = t?.date || t?.eventDate || null;
              return d === newDate;
            });

            const activeTask = CC.task.active.task.value;

            // If there are no tasks on the new date, or the currently active task doesn't belong
            // to the new date, clear selection and switch to creation mode.
            if (
              !tasksOnDate.length ||
              (activeTask &&
                String(activeTask?.date || activeTask?.eventDate) !== String(newDate))
            ) {
              try {
                // Clear any active task so the form enters add mode (no initialTask)
                if (CC.task && CC.task.active && CC.task.active.setTask)
                  CC.task.active.setTask(null);
                else if (CC.task && CC.task.active) CC.task.active.task.value = null;

                // Ensure the newTask helper defaults to a TimeEvent type so the form
                // shows the TimeEvent chooser when creating a new task.
                try {
                  if (typeof newTask !== "undefined" && newTask && "value" in newTask)
                    (newTask as any).value.type_id = "TimeEvent";
                } catch (e) {
                  // ignore if newTask isn't available
                }
              } catch (e) {
                try {
                  CC.task.active.task.value = null;
                } catch (_err) {
                  void _err;
                }
              }
              try {
                CC.task.active.mode.value = "add";
              } catch (e) {
                try {
                  if (CC.task.active.setMode) CC.task.active.setMode("add");
                } catch (_err) {
                  void _err;
                }
              }
            }
          } catch (e) {
            // ignore
          }
        }, 50);
      }
    } catch (e) {
      // ignore
    }
  }
);

// When mode changes to 'add' we usually reset the floating preview to default placement
// unless the add was initiated from a calendar day click (in which case the calendar
// handler already positioned the add form near the clicked day).
watch(
  () => CC.task.active.mode.value,
  (mode) => {
    try {
      if (mode === "add") {
        if (lastAddFromCalendar.value) {
          // allow calendar-initiated add to keep its floating placement, then reset flag
          lastAddFromCalendar.value = false;
        } else if (lastAddAnchored.value) {
          // anchored add (button/list) — consume the flag and keep placement
          lastAddAnchored.value = false;
        } else {
          // reset floating preview to default
          try {
            // clearing floating in mode watcher (mode=add)
          } catch (e) {
            void e;
          }
          try {
            setPreviewFloating(null);
          } catch (e) {
            void e;
          }
        }
      }
    } catch (e) {
      void e;
    }
  }
);

// createGroupUiHandlers removed: no UI opens the inline edit dialog

// mode change handling moved into CC.task

// Respond to preview requests coming from other parts of the app
// preview requests are handled by `CC.task.setPreviewTask` and mapped to `CC.task.active`

// If a payload was provided (e.g. from notifications) use it to preview the task
// payload-based previews are handled via `CC.task.setPreviewTask`

// calendar preview handled by createCalendarHandlers

const {
  isClickBlocked,
  newTask,

  filteredParentOptions,
  handleTaskClick,
  filterParentTasks,
} = createTaskViewHelpers({
  currentDate: CC.task.time.currentDate,
  currentDayData,
  setTaskToEdit,
  editTask,
});

// instantiate calendar handlers (safe: uses refs created above)
const {
  handleCalendarDateSelect,
  handleCalendarEdit,
  handleCalendarPreview,
} = createCalendarHandlers({
  isClickBlocked,
  newTask,
  setCurrentDate: (d: string | null) => CC.task.time.setCurrentDate(d),
  allTasks,
  editTask,
  setTask: (p: Parameters<typeof CC.task.active.setTask>[0]) => CC.task.active.setTask(p),
  activeMode: CC.task.active.mode,
  setPreviewTask: (p: Parameters<typeof CC.task.active.setTask>[0]) =>
    CC.task.active.setTask(p),
});

// compute task lists in a separate module for reuse and testability
const {
  sortedTasks,
  replenishTasks,
  doneTasks,
  tasksWithTime,
  tasksWithoutTime,
  groupOptions,
  activeGroupOptions,
  groupTree,
} = createTaskComputed({
  currentDayData,
  currentDate: CC.task.time.currentDate,
  allTasks,
  apiTask: CC.task,
  apiGroup: CC.group,
});

// group options, activeGroupOptions and groupTree are provided by createTaskComputed

// Return weekday and compact date (e.g., "Tuesday, 23.12.2025")
const formatDateOnly = (date: string) => formatDisplayDate(date);

const getGroupName = (groupId?: string): string => {
  if (!groupId) return "Unknown";
  const group = CC.group.list.all.value.find((g: Group) => g.id === groupId);
  return group ? group.name : "Unknown";
};

// Color/style computeds derived from the active group
const { activeGroupColor, headerStyle, cardStyle, watermarkTextColor } = useGroupColor(
  CC.group.list.all,
  CC.group.active.activeGroup
);

// Extract add/update handlers into a task CRUD module
const { handleAddTask, handleUpdateTask } = createTaskCrudHandlers({
  setCurrentDate: CC.task.time.setCurrentDate,
  activeGroup: CC.group.active.activeGroup,
  currentDate: CC.task.time.currentDate,
  allTasks,
  quasar: $q,
  active: CC.task.active,
});

const handleDeleteTask = async (payload: any) => {
  try {
    let id: string | undefined;
    let date: string = CC.task.time.currentDate.value;
    if (!payload) return;
    if (typeof payload === "string") {
      id = payload;
    } else if (typeof payload === "object") {
      id = payload.id;
      if (payload.date) date = payload.date;
    }
    if (!id) return;
    await CC.task.delete(date, id);
    // If the deleted task was currently selected for preview/edit, switch back to create mode
    if (CC.task.active.task.value && CC.task.active.task.value.id === id) {
      CC.task.active.setTask(null);
      CC.task.active.setMode("add");
    }
  } finally {
    openDeleteMenu.value = null;
  }
};

// Floating preview logic moved to composable to keep page code tidy
const {
  previewFloating,
  previewRect,
  setFloating: setPreviewFloating,
  anchorTo: anchorTo,
  closeFloatingPreview,
  hideFloating,
  computePreviewStyle,
} = useFloatingPreview({
  width: 640,
  shouldIgnoreClick: (target) => {
    try {
      // Ignore clicks inside Quasar teleported overlays (menus, dialogs, popups).
      // These are attached to <body> so they appear "outside" the panel even when
      // triggered by UI inside the panel (e.g. the group selector q-menu).
      if (target && (target as Element).closest) {
        if ((target as Element).closest('.q-menu, .q-dialog, .q-popup-proxy, .q-tooltip')) {
          return true;
        }
      }
    } catch (e) {
      void e;
    }
    try {
      const activeId = CC.task.active.task.value?.id;
      if (activeId && target && (target as Element).closest) {
        return Boolean((target as Element).closest(`[data-task-id="${activeId}"]`));
      }
    } catch (e) {
      void e;
    }
    return false;
  },
  onClickOutside: () => {
    // Hide the panel (slide it away) without resetting the active task/form.
    // The "Show" button will appear so the user can restore it.
    panelHidden.value = true;
  },
});

// Ensure `.fixed-content` receives the `floating` class when previewFloating changes.
// This is a defensive fallback for cases where template reactivity or scoped styles
// prevent the class from being applied as expected in the DOM inspector.
watch(
  previewFloating,
  (val) => {
    try {
      const el = document.querySelector(".fixed-right-panel .fixed-content");
      if (!el) return;
      if (val) el.classList.add("floating");
      else el.classList.remove("floating");
    } catch (e) {
      void e;
    }
  },
  { immediate: false }
);

const lastAddFromCalendar = ref(false);
const lastAddAnchored = ref(false);

const isAddButtonAnchored = computed(() => {
  try {
    if (!previewFloating.value || !previewRect.value) return false;
    const el = document.querySelector(".list-add-btn");
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const pr = previewRect.value;
    const tol = 4; // allow minor layout rounding
    return (
      Math.abs(r.x - pr.x) <= tol &&
      Math.abs(r.y - pr.y) <= tol &&
      Math.abs(r.width - pr.width) <= tol &&
      Math.abs(r.height - pr.height) <= tol
    );
  } catch (e) {
    return false;
  }
});

async function onListAdd(evt?: Event, go?: any) {
  try {
    // clear any active task so the form opens in 'add' mode
    try {
      CC.task.active.setTask(null);
    } catch (e) {
      void e;
    }
    // Indicate this 'add' was initiated from the anchored button so the
    // mode watcher does not clear the floating placement immediately.
    lastAddAnchored.value = true;
    try {
      CC.task.active.mode.value = "add";
    } catch (e) {
      try {
        if (CC.task.active.setMode) CC.task.active.setMode("add");
      } catch (_err) {
        void _err;
      }
    }

    // compute anchor element from event or fallback selector, then anchor
    let el: Element | null = null;
    try {
      if (evt && (evt.currentTarget as Element)) el = evt.currentTarget as Element;
      if (!el) el = document.querySelector(".list-add-btn");
    } catch (e) {
      void e;
    }

    panelHidden.value = false;
    try {
      if (anchorTo) {
        anchorTo(el || ".list-add-btn", { forceBelow: true });
      } else {
        // fallback
        let rect: DOMRect | null = null;
        if (el && el.getBoundingClientRect) rect = el.getBoundingClientRect();
        setPreviewFloating(rect, { forceBelow: true });
      }
      // preview state updated
    } catch (e) {
      void e;
    }
  } catch (e) {
    void e;
  }
}

async function onCalendarDayClick(payload: { date: string; rect: DOMRect | null }) {
  try {
    lastAddFromCalendar.value = true;
    // Clear any active task so AddTaskForm enters add mode
    try {
      CC.task.active.setTask(null);
    } catch (e) {
      void e;
    }
    // switch to add mode
    try {
      CC.task.active.mode.value = "add";
    } catch (e) {
      try {
        if (CC.task.active.setMode) CC.task.active.setMode("add");
      } catch (_err) {
        void _err;
      }
    }

    // Ensure the newTask helper is initialized to the clicked date and TimeEvent type
    try {
      if (typeof newTask !== "undefined" && newTask && "value" in newTask) {
        (newTask as any).value.eventDate =
          payload?.date || CC.task.time.currentDate.value;
        (newTask as any).value.type_id = "TimeEvent";
      }
    } catch (e) {
      void e;
    }

    // Ensure the calendar's currentDate is in sync
    try {
      CC.task.time.setCurrentDate(payload?.date || CC.task.time.currentDate.value);
    } catch (e) {
      void e;
    }

    if (payload && payload.rect) {
      // Position the add form near the clicked calendar day after DOM render
      await nextTick();
      // wait one animation frame for layout to stabilize
      await new Promise((r) => requestAnimationFrame(r));
      try {
        const selector = `[data-day="${payload.date}"]`;
        const el = document.querySelector(selector);
        let newRect: DOMRect | null = null;
        if (el instanceof Element) newRect = el.getBoundingClientRect();
        else newRect = payload.rect ?? null;
        setPreviewFloating(newRect);
        panelHidden.value = false;
      } catch (e) {
        setPreviewFloating(payload.rect);
        panelHidden.value = false;
      }
    } else {
      // No rect provided => ensure default placement
      // No rect provided => clear floating
      setPreviewFloating(null);
      panelHidden.value = false;
    }
  } catch (e) {
    void e;
  }
}

// Inline list add button — open add form in fixed panel without anchoring/floating
async function onInlineAdd() {
  try {
    try {
      CC.task.active.setTask(null);
    } catch (e) {
      void e;
    }
    // ensure anchored flags are not set so mode watcher won't preserve floating
    lastAddAnchored.value = false;
    lastAddFromCalendar.value = false;

    try {
      CC.task.active.mode.value = "add";
    } catch (e) {
      try {
        if (CC.task.active.setMode) CC.task.active.setMode("add");
      } catch (_err) {
        void _err;
      }
    }

    panelHidden.value = false;
    // explicitly clear any floating placement so the fixed panel is used
    try {
      setPreviewFloating(null);
    } catch (e) {
      void e;
    }
  } catch (e) {
    void e;
  }
}

// Bottom-right floating button: open fixed add form (no floating)
async function onFloatingAddClick() {
  try {
    try {
      CC.task.active.setTask(null);
    } catch (e) {
      void e;
    }
    // Ensure we don't preserve an anchored floating placement
    lastAddAnchored.value = false;
    lastAddFromCalendar.value = false;

    try {
      CC.task.active.mode.value = "add";
    } catch (e) {
      try {
        if (CC.task.active.setMode) CC.task.active.setMode("add");
      } catch (_err) {
        void _err;
      }
    }

    // show the panel and explicitly clear floating placement
    panelHidden.value = false;
    try {
      setPreviewFloating(null);
    } catch (e) {
      void e;
    }
  } catch (e) {
    void e;
  }
}

const handleToggleStatus = async (task: any) => {
  try {
    if (!task) return;
    const date = task?.date || task?.eventDate || CC.task.time.currentDate.value || "";
    const id = task.id || task._id || task.uuid;
    if (!id) return;
    await CC.task.status.toggleComplete(date, id);
  } catch (e) {
    // ignore
  }
};

// `toggleStatus` delegates to the task API; child components call the API directly now.

const handleFirstGroupCreation = async (data: { name: string; color: string }) => {
  const group = await CC.group.add({
    name: data.name,
    color: data.color,
    hideTasksFromParent: false,
  });
  defaultGroupId.value = group.id;
  CC.group.active.set(group);
  showFirstRunDialog.value = false;
};

// Advance to today if behind the clock; also starts a periodic 60-second check
useDayRollover({
  currentDate: CC.task.time.currentDate,
  setCurrentDate: (d) => CC.task.time.setCurrentDate(d),
});

onMounted(async () => {
  try {
    await CC.storage.loadData();
    // Ensure the app starts on today's date if stored date is older or missing
    try {
      const todayStr = todayString();
      const curStr = String(CC.task.time.currentDate?.value || "");
      if (!curStr || curStr < todayStr) {
        try {
          CC.task.time.setCurrentDate(todayStr);
        } catch (e) {
          void e;
        }
      }
    } catch (e) {
      void e;
    }
  } catch (error) {
    logger.error("Failed to load data on mount:", error);
  }

  // Listen for global reload events (e.g. from MainLayout refresh button)
  // Handlers are assigned to outer-scope vars so cleanup can be registered synchronously
  organiserReloadHandler = async () => {
    // do not reload data on organiser:reloaded; initial load happens on mount
    try {
      // noop for data load
    } catch (e) {
      // ignore
    }
    try {
      // If current active date is before today, move active day to today when refreshing
      const todayStr = todayString();
      if (CC.task.time.currentDate && CC.task.time.currentDate.value) {
        // Compare YYYY-MM-DD strings to avoid Date parsing/timezone issues.
        const curStr = String(CC.task.time.currentDate.value || "");
        if (curStr < todayStr) {
          try {
            CC.task.time.setCurrentDate(todayStr);
          } catch (e) {
            // ignore
          }
        }
      }
    } catch (e) {
      // ignore
    }
    // bump reload key to force child components to re-render where necessary
    reloadKey.value += 1;
  };
  window.addEventListener("organiser:reloaded", organiserReloadHandler as EventListener);
  // allow header group 'manage' button to open the group dialog
  organiserGroupManageHandler = () => {
    showGroupDialog.value = true;
  };
  window.addEventListener("group:manage", organiserGroupManageHandler as EventListener);

  // allow TaskListOptionsMenu 'edit group' action to open the dedicated edit dialog
  organiserGroupManageEditHandler = (e: Event) => {
    const groupId = (e as CustomEvent<{ groupId?: string }>).detail?.groupId ?? null;
    editDialogGroupId.value = groupId;
    showGroupEditDialog.value = true;
  };
  window.addEventListener(
    "group:manage-edit",
    organiserGroupManageEditHandler as EventListener
  );

  // allow TaskListOptionsMenu 'Join new member or device' to open community dialog
  organiserCommunityOpenHandler = () => {
    showCommunityDialog.value = true;
  };
  window.addEventListener(
    "community:open",
    organiserCommunityOpenHandler as EventListener
  );

  // Show first run dialog if no groups exist
  if (CC.group.list.all.value.length === 0) {
    showFirstRunDialog.value = true;
  } else {
    // Auto-select first group as active if groups exist
    const firstGroup = CC.group.list.all.value[0];
    if (firstGroup && !CC.group.active.activeGroup.value) {
      CC.group.active.set(firstGroup);
      defaultGroupId.value = firstGroup.id;
    }
  }
});
</script>

<style scoped>
.list-add-btn {
  position: absolute;
  right: 0px;
  bottom: 0px;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
  border-radius: 30px 0 0 0;
  border-bottom-right-radius: 8px;
  z-index: 2400;
}
.list-add-btn .q-icon {
  color: #fff !important;
}
</style>

<style lang="scss" src="../css/day-organiser-page.scss"></style>
