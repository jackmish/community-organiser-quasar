<template>
  <q-page class="q-pa-md">
    <!-- top selector removed; groups shown in the header -->

    <!-- Loading State -->
    <div
      v-if="api.storage.isLoading && api.storage.isLoading.value"
      class="text-center q-pa-lg"
    >
      <q-spinner color="primary" size="3em" />
    </div>
    <!-- Single TaskPreview instance: when `previewFloating` is true it will be positioned
         near the clicked task by applying an inline fixed-position style; otherwise it
         stays inside the fixed-right-panel as before. This avoids rendering two copies. -->
    <div v-else>
      <div class="row q-col-gutter-md tasks-row">
        <div class="col-12 left-panel tasks-column">
          <q-card class="task-list-card">
            <q-card-section>
              <div class="text-h6 task-list-header">
                <div
                  class="row items-center justify-between"
                  style="align-items: center; margin-top: 6px; justify-content: center"
                >
                  <div class="row items-center" style="gap: 8px">
                    <q-btn
                      flat
                      dense
                      round
                      icon="chevron_left"
                      @click="api.task.time.prevDay"
                      color="primary"
                    />

                    <span
                      :class="[
                        'text-weight-bold',
                        getTimeDiffClass(api.task.time.currentDate),
                      ]"
                      >{{ formatDateOnly(api.task.time.currentDate.value) }}</span
                    >
                    <q-btn
                      flat
                      dense
                      round
                      icon="chevron_right"
                      @click="api.task.time.nextDay"
                      color="primary"
                    />
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
              <Watermark :active-group="api.group.active.activeGroup" />
            </q-card-section>
            <q-card-section v-if="sortedTasks.length === 0">
              <p class="text-grey-6">No tasks for this day</p>
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
              @edit-task="editTask"
              @delete-task="handleDeleteTask"
              @toggle-status="handleToggleStatus"
            />
          </q-card>
        </div>
      </div>

      <div class="row q-col-gutter-md q-mt-md">
        <div class="col-12 col-md-8">
          <CalendarView
            :key="reloadKey"
            :selected-date="api.task.time.currentDate.value"
            :tasks="allTasks"
            @update:selectedDate="(d) => api.task.time.setCurrentDate(d)"
            @day-click="onCalendarDayClick"
          />
        </div>
        <div class="col-12 col-md-4">
          <div class="q-mb-md">
            <DoneTasksList :done-tasks="doneTasks" />
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
    <!-- First Run Dialog -->
    <FirstRunDialog
      v-model="showFirstRunDialog"
      @create="handleFirstGroupCreation"
      @import="handleImportFile"
    />

    <!-- Floating Add button: appears in edit/preview or when panel is hidden -->
    <q-btn
      v-if="panelHidden || api.task.active.mode.value !== 'add'"
      class="floating-add-btn"
      color="green"
      fab
      icon="add"
      dense
      @click="clearTaskToEdit"
      title="Add new task"
    />
    <div :class="['fixed-right-panel', { 'panel-hidden': panelHidden }]">
      <q-btn
        v-if="!panelHidden"
        unelevated
        color="dark"
        class="panel-toggle-btn"
        label="Hide"
        icon="keyboard_arrow_down"
        @click="panelHidden = true"
      />
      <div
        class="fixed-content"
        :class="{ floating: previewFloating }"
        :style="previewFloating ? computePreviewStyle(previewRect) : {}"
      >
        <!-- Single TaskPreview instance: toggles between floating and fixed placement -->
        <TaskPreview
          v-if="api.task.active.mode.value === 'preview' && api.task.active.task.value"
          :task="api.task.active.task.value"
          :group-name="getGroupName(api.task.active.task.value.groupId)"
          :animating-lines="animatingLines"
          @line-collapsed="onLineCollapsed"
          @line-expanded="onLineExpanded"
          @edit="
            () => {
              api.task.active.mode.value = 'edit';
            }
          "
          @close="clearTaskToEdit"
          @update-task="(t) => handleUpdateTask(t)"
          :fixed="!previewFloating"
        />

        <!-- Floating wrapper for AddTaskForm when previewFloating is true -->
        <div class="floating-preview-wrapper" v-if="previewFloating">
          <AddTaskForm
            v-if="
              api.task.active.mode.value === 'add' ||
              api.task.active.mode.value === 'edit'
            "
            :filtered-parent-options="filteredParentOptions"
            :active-group="api.group.active.activeGroup"
            :show-calendar="false"
            :selected-date="newTask.eventDate"
            :all-tasks="allTasks"
            :replenish-tasks="replenishTasks"
            :initial-task="api.task.active.task.value"
            :mode="api.task.active.mode.value"
            @update:mode="(v) => api.task.active.setMode(v)"
            @add-task="handleAddTask"
            @update-task="handleUpdateTask"
            @delete-task="handleDeleteTask"
            @toggle-status="handleToggleStatus"
            @cancel-edit="() => clearTaskToEdit()"
            @calendar-date-select="handleCalendarDateSelect"
            @filter-parent-tasks="filterParentTasks"
          />
        </div>

        <!-- When not floating, render AddTaskForm inside the fixed panel as before -->
        <div v-if="!previewFloating">
          <AddTaskForm
            v-if="
              api.task.active.mode.value === 'add' ||
              api.task.active.mode.value === 'edit'
            "
            :filtered-parent-options="filteredParentOptions"
            :active-group="api.group.active.activeGroup"
            :show-calendar="false"
            :selected-date="newTask.eventDate"
            :all-tasks="allTasks"
            :replenish-tasks="replenishTasks"
            :initial-task="api.task.active.task.value"
            :mode="api.task.active.mode.value"
            @update:mode="(v) => api.task.active.setMode(v)"
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
    <!-- Show button visible when the panel is hidden and a task is selected (edit/preview) -->
    <q-btn
      v-if="panelHidden && api.task.active.mode.value !== 'add'"
      class="panel-show-btn"
      unelevated
      color="dark"
      icon="keyboard_arrow_up"
      label="Show"
      @click="panelHidden = false"
    />
  </q-page>
</template>

<script setup lang="ts">
import { format } from "date-fns";

import AddTaskForm from "../components/task/AddTaskForm.vue";
import Watermark from "src/components/ui/Watermark.vue";

import DoneTasksList from "../components/task/DoneTasksList.vue";
import GroupManagementDialog from "../components/group/GroupManagementDialog.vue";

import { formatDisplayDate } from "src/modules/task/utlils/occursOnDay";
import TaskPreview from "../components/task/TaskPreview.vue";
import CalendarView from "src/components/time/CalendarView.vue";
import GroupSelectHeader from "../components/group/GroupSelectHeader.vue";
import { useDayOrganiserView } from "src/composables/useDayOrganiserView";
import { createLineEventHandlers } from "src/modules/task/lineEventHandlers";
import { createTaskUiHandlers, createTaskViewHelpers } from "src/modules/task/uiHandlers";
import { createCalendarHandlers } from "src/modules/task/calendarHandlers";
import { createTaskComputed } from "src/modules/task/computedTaskLists";
import { createTaskCrudHandlers } from "src/modules/task/taskCrudHandlers";
import TasksListSmall from "src/components/task/TasksListSmall.vue";

// Use shared view composable for clock and time-diff helpers
const { now, getTimeDifferenceDisplay, getTimeDiffClass } = useDayOrganiserView();

// calendar handlers will be provided by createCalendarHandlers (instantiated after refs)

import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
import { useFloatingPreview } from "src/composables/useFloatingPreview";
import { useQuasar } from "quasar";
import logger from "src/utils/logger";
import * as api from "src/modules/day-organiser/_apiRoot";

import { createHiddenGroupSummary } from "src/modules/task/hiddenGroupSummaryFixed";
import type { TaskGroup } from "../modules/day-organiser";
import FirstRunDialog from "../components/settings/FirstRunDialog.vue";
import { occursOnDay, getCycleType } from "src/modules/task/utlils/occursOnDay";
import { isVisibleForActive as groupIsVisible } from "src/modules/group/groupUtils";

const $q = useQuasar();

const currentDayData = computed(() => {
  const days = api.task.time.days.value || {};
  const d = api.task.time.currentDate.value;
  return days[d] || ({ date: d, tasks: [], notes: "" } as any);
});

function onTaskClicked(task: any, rect?: DOMRect | null) {
  try {
    const activeId = api.task.active.task.value?.id;
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
        // fallback: use api directly
        api.task.active.setTask(task);
        api.task.active.mode.value = "preview";
      } catch (err) {
        void err;
      }
    }
    // If we received a bounding rect, show floating preview near it
    setPreviewFloating(rect ?? null);
  } catch (e) {
    void e;
  }
}

// Provide a lightweight organiser-like ref for legacy helpers that expect
// an `organiserData` ref with `groups` and `days`.
const organiserLike = computed(() => ({
  groups: api.group.list.all.value,
  days: api.task.time.days.value,
}));

const hiddenGroupSummary = createHiddenGroupSummary(
  organiserLike as any,
  api.group.active.activeGroup
);

// All tasks across days — used to render calendar events
const allTasks = computed(() => api.task.list.all());

// `hiddenGroupSummary` moved to the day-organiser module for reuse

const showGroupDialog = ref(false);

// Inline edit-group dialog removed (unused)
const showFirstRunDialog = ref(false);

const defaultGroupId = ref<string | undefined>(undefined);
const openDeleteMenu = ref<string | null>(null);
// when true the fixed panel is moved off-screen (hidden) and only the show button is visible
const panelHidden = ref(false);
const selectedTaskId = computed(() => api.task.active.task.value?.id ?? null);
const reloadKey = ref(0);
const animatingLines = ref<number[]>([]);
// child line animation handlers (API handles the data changes)
const { onLineCollapsed, onLineExpanded } = createLineEventHandlers();

// task UI handlers moved to module
const { setTaskToEdit, editTask, clearTaskToEdit } = createTaskUiHandlers({
  activeTask: api.task.active.task,
  activeMode: api.task.active.mode,
  setActiveTask: api.task.active.setTask,
  panelHidden,
  currentDate: api.task.time.currentDate,
  setCurrentDate: api.task.time.setCurrentDate,
});

// outer-scope handlers for window events (registered/assigned inside onMounted)
let organiserReloadHandler: any = null;

const handleImportFile = async (file: File) => {
  // Safely use Quasar Loading plugin if present
  const safeShow = () => {
    try {
      if ($q && $q.loading && typeof $q.loading.show === "function") {
        $q.loading.show({ message: "Importing data..." } as any);
      }
    } catch (e) {
      // ignore
    }
  };
  const safeHide = () => {
    try {
      if ($q && $q.loading && typeof $q.loading.hide === "function") {
        $q.loading.hide();
      }
    } catch (e) {
      // ignore
    }
  };

  try {
    safeShow();
    // Use storage.importFromFile to accept .zip or .json File and return OrganiserData
    const data = await api.storage.importFromFile(file);
    if (data) {
      await api.storage.saveData(data);
      await api.storage.loadData();
    }
    safeHide();
    showFirstRunDialog.value = false;
    // reload view
    reloadKey.value = reloadKey.value + 1;
    const safeNotify = (opts: any) => {
      try {
        if ($q && $q.notify && typeof $q.notify === "function") return $q.notify(opts);
      } catch (e) {
        void e;
      }
      try {
        // fallback
        if (opts && opts.message) alert(opts.message);
      } catch (e) {
        // ignore
      }
    };

    safeNotify({ type: "positive", message: "Import successful" });
  } catch (err) {
    safeHide();
    console.error("Import failed", err);
    const safeNotify = (opts: any) => {
      try {
        if ($q && $q.notify && typeof $q.notify === "function") return $q.notify(opts);
      } catch (e) {
        void e;
      }
      try {
        if (opts && opts.message) alert(opts.message);
      } catch (e) {
        // ignore
      }
    };
    safeNotify({
      type: "negative",
      message: "Import failed: " + String((err as any)?.message || err),
    });
  }
};
let organiserGroupManageHandler: any = null;

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
  } catch (e) {
    // ignore
  }
});

// Ensure we return to 'add' mode when no task is selected
watch(
  () => api.task.active.task.value,
  (val) => {
    if (!val && api.task.active.mode.value !== "add") {
      api.task.active.mode.value = "add";
    }
  }
);

// When the current date changes (via calendar or prev/next arrows), switch to creation mode
watch(
  () => api.task.time.currentDate.value,
  (newDate, oldDate) => {
    try {
      if (newDate !== oldDate) {
        // Defer check so other date-change handlers (e.g. calendar preview) run first.
        setTimeout(() => {
          try {
            // Determine if the selected date has any tasks
            const all =
              api.task.list && typeof api.task.list.all === "function"
                ? api.task.list.all()
                : [];
            const tasksOnDate = (all || []).filter((t: any) => {
              const d = t?.date || t?.eventDate || null;
              return d === newDate;
            });

            const activeTask = api.task.active.task.value;

            // If there are no tasks on the new date, or the currently active task doesn't belong
            // to the new date, clear selection and switch to creation mode.
            if (
              !tasksOnDate.length ||
              (activeTask &&
                String(activeTask?.date || activeTask?.eventDate) !== String(newDate))
            ) {
              try {
                // Clear any active task so the form enters add mode (no initialTask)
                if (api.task && api.task.active && api.task.active.setTask)
                  api.task.active.setTask(null);
                else if (api.task && api.task.active) api.task.active.task.value = null;

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
                  api.task.active.task.value = null;
                } catch (_err) {
                  void _err;
                }
              }
              try {
                api.task.active.mode.value = "add";
              } catch (e) {
                try {
                  if (api.task.active.setMode) api.task.active.setMode("add");
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
  () => api.task.active.mode.value,
  (mode) => {
    try {
      if (mode === "add") {
        if (lastAddFromCalendar.value) {
          // allow calendar-initiated add to keep its floating placement, then reset flag
          lastAddFromCalendar.value = false;
        } else {
          // reset floating preview to default
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

// mode change handling moved into api.task

// Respond to preview requests coming from other parts of the app
// preview requests are handled by `api.task.setPreviewTask` and mapped to `api.task.active`

// If a payload was provided (e.g. from notifications) use it to preview the task
// payload-based previews are handled via `api.task.setPreviewTask`

// calendar preview handled by createCalendarHandlers

const {
  isClickBlocked,
  newTask,

  filteredParentOptions,
  handleTaskClick,
  filterParentTasks,
  parseYmdLocal,
  getTimeOffsetDaysForTask,
} = createTaskViewHelpers({
  currentDate: api.task.time.currentDate,
  setCurrentDate: api.task.time.setCurrentDate,
  currentDayData,
  allTasks,
  groups: api.group.list.all,
  activeGroup: api.group.active.activeGroup,
  getGroupsByParent: api.group.list.getGroupsByParent,
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
  setCurrentDate: api.task.time.setCurrentDate,
  allTasks,
  editTask,
  setTask: api.task.active.setTask,
  activeMode: api.task.active.mode,
  setPreviewTask: api.task.active.setTask,
  notify: (opts: any) => $q.notify(opts),
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
  currentDate: api.task.time.currentDate,
  allTasks,
  apiTask: api.task,
  apiGroup: api.group,
});

// group options, activeGroupOptions and groupTree are provided by createTaskComputed

// Return weekday and compact date (e.g., "Tuesday, 23.12.2025")
const formatDateOnly = (date: string) => formatDisplayDate(date);

const getGroupName = (groupId?: string): string => {
  if (!groupId) return "Unknown";
  const group = api.group.list.all.value.find((g: TaskGroup) => g.id === groupId);
  return group ? group.name : "Unknown";
};

// Extract add/update handlers into a task CRUD module
const { handleAddTask, handleUpdateTask } = createTaskCrudHandlers({
  setCurrentDate: api.task.time.setCurrentDate,
  activeGroup: api.group.active.activeGroup,
  currentDate: api.task.time.currentDate,
  allTasks,
  quasar: $q,
  active: api.task.active,
});

const handleDeleteTask = async (payload: any) => {
  try {
    let id: string | undefined;
    let date: string = api.task.time.currentDate.value;
    if (!payload) return;
    if (typeof payload === "string") {
      id = payload;
    } else if (typeof payload === "object") {
      id = payload.id;
      if (payload.date) date = payload.date;
    }
    if (!id) return;
    await api.task.delete(date, id);
    // If the deleted task was currently selected for preview/edit, switch back to create mode
    if (api.task.active.task.value && api.task.active.task.value.id === id) {
      api.task.active.setTask(null);
      api.task.active.setMode("add");
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
  closeFloatingPreview,
  computePreviewStyle,
} = useFloatingPreview({
  width: 360,
  shouldIgnoreClick: (target) => {
    try {
      const activeId = api.task.active.task.value?.id;
      if (activeId && target && (target as Element).closest) {
        return Boolean((target as Element).closest(`[data-task-id="${activeId}"]`));
      }
    } catch (e) {
      void e;
    }
    return false;
  },
});

const lastAddFromCalendar = ref(false);

function onCalendarDayClick(payload: { date: string; rect: DOMRect | null }) {
  try {
    lastAddFromCalendar.value = true;
    // Clear any active task so AddTaskForm enters add mode
    try {
      api.task.active.setTask(null);
    } catch (e) {
      void e;
    }
    // switch to add mode
    try {
      api.task.active.mode.value = "add";
    } catch (e) {
      try {
        if (api.task.active.setMode) api.task.active.setMode("add");
      } catch (_err) {
        void _err;
      }
    }

    if (payload && payload.rect) {
      // Position the add form near the clicked calendar day
      setPreviewFloating(payload.rect);
    } else {
      // No rect provided => ensure default placement
      setPreviewFloating(null);
    }
  } catch (e) {
    void e;
  }
}

const handleToggleStatus = async (task: any) => {
  try {
    if (!task) return;
    const date = task?.date || task?.eventDate || api.task.time.currentDate.value || "";
    const id = task.id || task._id || task.uuid;
    if (!id) return;
    await api.task.status.toggleComplete(date, id);
  } catch (e) {
    // ignore
  }
};

// `toggleStatus` delegates to the task API; child components call the API directly now.

const handleFirstGroupCreation = async (data: { name: string; color: string }) => {
  const group = await api.group.add({
    name: data.name,
    color: data.color,
    hideTasksFromParent: false,
  });
  defaultGroupId.value = group.id;
  api.group.active.activeGroup.value = {
    label: group.name,
    value: group.id,
  };
  showFirstRunDialog.value = false;
};

onMounted(async () => {
  try {
    await api.storage.loadData();
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
      const todayStr = format(new Date(), "yyyy-MM-dd");
      if (api.task.time.currentDate && api.task.time.currentDate.value) {
        const cur = new Date(api.task.time.currentDate.value);
        const today = new Date(todayStr);
        // normalize to midnight for comparison
        const curNorm = new Date(
          cur.getFullYear(),
          cur.getMonth(),
          cur.getDate()
        ).getTime();
        const todayNorm = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate()
        ).getTime();
        if (curNorm < todayNorm) {
          try {
            api.task.time.setCurrentDate(todayStr);
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

  // Show first run dialog if no groups exist
  if (api.group.list.all.value.length === 0) {
    showFirstRunDialog.value = true;
  } else {
    // Auto-select first group as active if groups exist
    const firstGroup = api.group.list.all.value[0];
    if (firstGroup && !api.group.active.activeGroup.value) {
      api.group.active.activeGroup.value = {
        label: firstGroup.name,
        value: firstGroup.id,
      };
      defaultGroupId.value = firstGroup.id;
    }
  }
});
</script>

<style lang="scss" src="../css/day-organiser-page.scss"></style>
