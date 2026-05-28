<template>
  <q-page class="q-pa-md">
    <!-- top selector removed; groups shown in the header -->

    <!-- Loading State -->
    <div
      v-if="!organiserReady || (CC.storage.isLoading && CC.storage.isLoading.value)"
      class="text-center q-pa-lg"
    >
      <q-spinner color="primary" size="3em" />
    </div>
    <!-- Single TaskPreview instance: when `previewFloating` is true it will be positioned
         near the clicked task by applying an inline fixed-position style; otherwise it
         stays inside the fixed-right-panel as before. This avoids rendering two copies. -->
    <div v-else>
      <div class="row q-col-gutter-md tasks-row">
        <div
          ref="dayViewSectionRef"
          class="col-12 left-panel tasks-column day-organiser-day-section day-organiser-scroll-anchor"
          style="position: relative"
        >
          <q-card class="task-list-card" :style="cardStyle">
            <q-card-section>
              <div class="text-h6 task-list-header" :style="headerStyle">
                <div class="row items-center task-header-row" >
                  <div v-if="!$q.screen.lt.md" class="task-header-device-strip">
                    <div
                      v-for="d in headerDeviceStatus"
                      :key="d.id"
                      class="task-header-device-pill"
                      :class="deviceStatusPillClass(d.status)"
                    >
                      <q-icon
                        :name="d.linkIcon"
                        size="16px"
                        class="task-header-device-pill__link"
                      />
                      <div class="task-header-device-pill__labels">
                        <span class="task-header-device-pill__line">{{ d.shortLine1 }}</span>
                        <span v-if="d.shortLine2" class="task-header-device-pill__line">{{
                          d.shortLine2
                        }}</span>
                      </div>
                      <q-tooltip anchor="bottom middle" self="top middle">{{ d.name }}</q-tooltip>
                    </div>
                  </div>
                  <div v-if="!$q.screen.lt.md" class="row items-center no-wrap task-header-sync-tools">
                    <q-btn
                      flat
                      dense
                      round
                      class="task-header-date-btn"
                      :style="{ color: headerStyle.color }"
                      :loading="headerSyncRunning"
                      :disable="headerSyncRunning"
                      :title="$text('accounts.sync_now')"
                      :aria-label="$text('accounts.sync_now')"
                      @click="void onHeaderManualSync()"
                    >
                      <q-icon
                        name="sync"
                        :style="'color: ' + headerStyle.color + ' !important;'"
                      />
                    </q-btn>
                    <q-btn
                      flat
                      dense
                      round
                      class="task-header-date-btn"
                      :style="{ color: headerStyle.color }"
                      :loading="headerSyncRunning"
                      :disable="headerSyncRunning"
                      :title="$text('sync.full_sync_now')"
                      :aria-label="$text('sync.full_sync_now')"
                      @click="void onHeaderFullSync()"
                    >
                      <q-icon
                        name="sync_alt"
                        :style="'color: ' + headerStyle.color + ' !important;'"
                      />
                    </q-btn>
                    <div class="task-header-v-separator" aria-hidden="true" />
                  </div>
                  <div class="row items-center no-wrap task-header-date-nav">
                    <q-btn
                      flat
                      dense
                      round
                      class="task-header-date-btn"
                      @click="CC.task.time.prevDay"
                    >
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
                      >{{ formatHeaderDate(CC.task.time.currentDate.value) }}</span
                    >
                    <q-btn
                      flat
                      dense
                      round
                      class="task-header-date-btn"
                      @click="CC.task.time.nextDay"
                    >
                      <q-icon
                        name="chevron_right"
                        :style="'color: ' + headerStyle.color + ' !important;'"
                      />
                    </q-btn>
                  </div>
                  <!-- Insert today's full date/time near the task list header (swapped from main header) -->
                  <div
                    class="task-header-group-select"
                    style="
                      display: flex;
                      align-items: center;
                      gap: 8px;
                      position: relative;
                    "
                  >
                    <GroupSelectHeader :device-statuses="headerDeviceStatus" />
                  </div>
                </div>
              </div>
              <Watermark
                :active-group="CC.group.active.activeGroup"
                :label="activeGroupWatermarkLabel"
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
            :aria-label="$text('ui.add_new_task')"
            @click="onListAdd"
          >
            <q-icon name="add" />
          </q-btn>
        </div>
      </div>

      <div class="row q-col-gutter-md q-mt-md">
        <div
          ref="calendarSectionRef"
          class="col-12 col-md-8 day-organiser-calendar-section day-organiser-scroll-anchor"
          :class="{ 'day-organiser-calendar-section--pick': todoScheduleActive }"
        >
          <div
            v-if="todoScheduleActive"
            class="todo-schedule-pick-banner"
            role="status"
          >
            <span>{{ $text('task.todo.choose_day') }}</span>
            <q-btn
              flat
              dense
              round
              color="white"
              icon="close"
              :aria-label="$text('action.cancel')"
              @click="cancelTodoSchedule"
            />
          </div>
          <CalendarView
            :key="reloadKey"
            :selected-date="CC.task.time.currentDate.value"
            :tasks="allTasks"
            @update:selectedDate="onCalendarSelectedDate"
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
      @create-group="openGroupEditDialog(null)"
      @edit-group="openGroupEditDialog"
    />
    <!-- Group Edit Dialog (opened from options menu) -->
    <GroupEditDialog
      v-model="showGroupEditDialog"
      :editing-group-id="editDialogGroupId"
      :initial-parent-id="createGroupParentId"
    />
    <q-dialog v-model="showGroupMergeDialog">
      <q-card style="min-width: min(560px, 96vw)">
        <q-card-section class="row items-center q-pb-sm">
          <div class="text-h6">{{ $text('group.merge_group') }}</div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <div class="text-caption text-grey-7 q-mb-sm">{{ $text('group.merge_group_hint') }}</div>
          <div class="column q-gutter-sm items-center">
            <q-chip dense square color="primary" text-color="white">
              {{ mergeSourceLabel }}
            </q-chip>
            <q-icon name="arrow_downward" />
            <div class="full-width" style="max-width: min(460px, 94vw)">
              <div class="text-caption q-mb-xs">{{ $text('group.merge_target') }}</div>
              <GroupTreeSelector
                :nodes="mergeTargetTree"
                :selected="mergeTargetGroupId ? [String(mergeTargetGroupId)] : []"
                max-height="36vh"
                @update:selected="onMergeTargetTreeSelect"
              />
            </div>
            <q-chip v-if="mergeTargetLabel" dense square color="secondary" text-color="white">
              {{ mergeTargetLabel }}
            </q-chip>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="$text('action.cancel')" @click="showGroupMergeDialog = false" />
          <q-btn
            unelevated
            color="negative"
            icon="merge_type"
            :disable="!canMergeCurrentGroup || !mergeTargetGroupId || mergeRunning"
            :loading="mergeRunning"
            :label="$text('group.merge_group')"
            @click="void confirmGroupMerge()"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
    <!-- Join Member Dialog (opened from options menu 'Join new member or device') -->
    <JoinMemberDialog
      v-model="showCommunityDialog"
      @open-roles-setup="openRolesSetupFromJoin"
    />
    <!-- First Run Dialog -->
    <FirstRunDialog
      v-model="showFirstRunDialog"
      @create="handleFirstGroupCreation"
      @import="handleImportFile"
    />

    <q-dialog
      v-if="$q.screen.lt.md"
      :model-value="!panelHidden"
      @update:model-value="(open) => { panelHidden = !open }"
      position="bottom"
      full-width
      :transition-duration="0"
      class="day-organiser-task-panel-dialog"
    >
      <div class="fixed-right-panel fixed-right-panel--mobile-dialog">
        <DayOrganiserTaskPanelContent />
      </div>
    </q-dialog>

    <div
      v-else
      :class="['fixed-right-panel', { 'panel-hidden': panelHidden }]"
    >
      <DayOrganiserTaskPanelContent />
    </div>

    <q-btn
      v-if="$q.screen.lt.md"
      unelevated
      color="primary"
      text-color="white"
      class="mobile-section-toggle-btn"
      :icon="scrollToggleIcon"
      :label="$text(scrollToggleLabelKey)"
      @click="onScrollToggleClick"
    />

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

    <div v-if="todoScheduleActive" class="todo-schedule-footer">
      <div
        class="todo-schedule-footer__date"
        :class="
          todoScheduleHasPickedDate
            ? 'text-primary text-weight-medium'
            : 'todo-schedule-footer__date--placeholder'
        "
      >
        {{
          todoScheduleHasPickedDate
            ? formatDisplayDate(todoSchedulePickedDate)
            : $text('task.todo.choose_day')
        }}
      </div>
      <div class="todo-schedule-footer__time">
        <q-input
          v-model.number="todoScheduleHour"
          type="number"
          :label="$text('label.hour')"
          outlined
          dense
          min="0"
          max="23"
          style="max-width: 88px"
        />
        <q-input
          v-model.number="todoScheduleMinute"
          type="number"
          :label="$text('label.minute')"
          outlined
          dense
          min="0"
          max="59"
          style="max-width: 88px"
        />
      </div>
      <div class="todo-schedule-footer__actions">
        <q-btn
          unelevated
          color="primary"
          :label="$text('task.todo.save_scheduled')"
          @click="confirmTodoSchedule(false)"
        />
        <q-btn
          unelevated
          color="orange"
          :label="$text('task.todo.save_and_edit')"
          @click="confirmTodoSchedule(true)"
        />
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { todayString, yesterdayString } from "src/utils/dateUtils";
import { createImportHandler } from "src/modules/storage/handlers/importHandlers";
import { useDayRollover } from "src/composables/useDayRollover";

import Watermark from "src/components/ui/Watermark.vue";
import DayOrganiserTaskPanelContent from "src/pages/components/DayOrganiserTaskPanelContent.vue";
import { dayOrganiserPanelKey, type DayOrganiserPanelContext } from "src/pages/dayOrganiserPanelKey";

import DoneTasksList from "src/modules/task/components/list/DoneTasksList.vue";
import PluginSlot from "../components/ui/PluginSlot.vue";
import GroupManagementDialog from "src/modules/group/components/GroupManagementDialog.vue";
import GroupEditDialog from "src/modules/group/components/GroupEditDialog.vue";
import JoinMemberDialog from "src/components/settings/JoinMemberDialog.vue";

import { formatDisplayDate } from "src/modules/task/utils/occursOnDay";
import CalendarView from "src/components/time/CalendarView.vue";
import GroupSelectHeader from "src/modules/group/components/GroupSelectHeader.vue";
import GroupTreeSelector from "src/modules/group/components/GroupTreeSelector.vue";
import { useDayOrganiserView } from "src/composables/useDayOrganiserView";
import { useGroupColor } from "src/composables/useGroupColor";
import { useLineEventHandlers } from "src/composables/useLineEventHandlers";
import { useTaskUiHandlers } from "src/composables/useTaskUiHandlers";
import { createTaskViewHelpers } from "src/modules/task/helpers/taskViewHelpers";
import { useCalendarHandlers } from "src/composables/useCalendarHandlers";
import { createTaskComputed } from "src/modules/task/computed/computedTaskLists";
import { useTaskCrud } from "src/composables/useTaskCrud";
import { resolveLocalGroupName } from "src/modules/group/utils/groupLocalNames";
import { todoCalendarSchedule } from "src/composables/useTodoCalendarSchedule";
import TasksListSmall from "src/modules/task/components/list/TasksListSmall.vue";
import { loadConnectionsDevices } from "src/modules/storage/sync/connectionsDeviceStorage";
import { runSyncWithPeer } from "src/modules/storage/sync/lanOrganiserSync";
import { loadSyncPeerStates } from "src/modules/storage/sync/syncPeerState";
import {
  loadActiveContractForSync,
} from "src/modules/storage/sync/syncContractSettings";
import {
  normalizeDeviceId,
  resolveEffectiveRole,
} from "src/modules/storage/sync/deviceRoleAssignment";
import { loadRoleProfiles } from "src/modules/storage/sync/roleProfileSettings";

// Use shared view composable for clock and time-diff helpers
const { now, getTimeDifferenceDisplay, getTimeDiffClass } = useDayOrganiserView();

// calendar handlers will be provided by createCalendarHandlers (instantiated after refs)

import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick, provide } from "vue";
import { useMobileOrganiserScrollToggle } from "src/composables/useMobileOrganiserScrollToggle";
import { checkAndSync, startSyncScheduler, stopSyncScheduler } from "src/modules/user/calendarSyncService";
import { $text } from "src/modules/lang";
import { useFloatingPreview } from "src/composables/useFloatingPreview";
import { useQuasar } from "quasar";
import logger from "src/utils/logger";
import CC from "src/CCAccess";
import { saveData } from "src/utils/storageUtils";
import { scheduleBackgroundLanSyncAfterDisplay } from "src/modules/storage/sync/lanOrganiserSyncTrigger";
import {
  buildDeviceStatusRow,
  deviceStatusPillClass,
  type DeviceConnectionStatus,
  type DeviceStatusRow,
} from "src/utils/deviceStatusDisplay";
import { probeLanPeerInfo } from "src/modules/lan/lanPeerConnectivity";
import type { ConnectedDevice } from "src/modules/storage/sync/deviceRoleAssignment";
import type { SyncPeerRecord } from "src/modules/storage/sync/syncPeerState";

import { createHiddenGroupSummary } from "src/modules/task/helpers/hiddenGroupSummary";
import type { Group } from "src/modules/group/models/GroupModel";
import FirstRunDialog from "../components/settings/FirstRunDialog.vue";

const $q = useQuasar();
const headerSyncRunning = ref(false);

const dayViewSectionRef = ref<HTMLElement | null>(null);
const calendarSectionRef = ref<HTMLElement | null>(null);
const {
  active: todoScheduleActive,
  sourceTask: todoScheduleSourceTask,
  pickedDate: todoSchedulePickedDate,
  scheduleHour: todoScheduleHour,
  scheduleMinute: todoScheduleMinute,
  hasPickedDate: todoScheduleHasPickedDate,
  cancel: cancelTodoScheduleState,
  pickDay: pickTodoScheduleDay,
  buildEventTime: buildTodoScheduleEventTime,
} = todoCalendarSchedule;

const isMobileOrganiser = computed(() => $q.screen.lt.md);
const { scrollToggleIcon, scrollToggleLabelKey, onScrollToggleClick } =
  useMobileOrganiserScrollToggle({
    enabled: isMobileOrganiser,
    daySectionRef: dayViewSectionRef,
    calendarSectionRef,
  });

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
        const all = CC.task.list.items();
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
              const all = CC.task.list.items();
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
          const all = CC.task.list.items();
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
const allTasks = computed(() => CC.task.list.items());

// `hiddenGroupSummary` moved to the day-organiser module for reuse

const showGroupDialog = ref(false);
const showGroupEditDialog = ref(false);
const editDialogGroupId = ref<string | null>(null);
const createGroupParentId = ref<string | null>(null);
const showGroupMergeDialog = ref(false);
const mergeTargetGroupId = ref<string | null>(null);
const mergeRunning = ref(false);
const headerDeviceStatus = ref<DeviceStatusRow[]>([]);

function openGroupEditDialog(groupId: string | null, parentId: string | null = null) {
  editDialogGroupId.value = groupId;
  createGroupParentId.value = groupId ? null : parentId;
  showGroupEditDialog.value = true;
}

// reset edit group id whenever that dialog is closed
watch(showGroupEditDialog, (v) => {
  if (!v) {
    editDialogGroupId.value = null;
    createGroupParentId.value = null;
  }
});
const showCommunityDialog = ref(false);

function openRolesSetupFromJoin(): void {
  showCommunityDialog.value = false;
}

// Inline edit-group dialog removed (unused)
const showFirstRunDialog = ref(false);

const defaultGroupId = ref<string | undefined>(undefined);
const openDeleteMenu = ref<string | null>(null);
// when true the fixed panel is moved off-screen (hidden) and only the show button is visible
// Start hidden so the task list is the first thing users see on app launch
const panelHidden = ref(true);

const selectedTaskId = computed(() => CC.task.active.task.value?.id ?? null);
/** False until disk load + startup LAN sync finish — keeps task list hidden until then. */
const organiserReady = ref(false);
const reloadKey = ref(0);
const animatingLines = ref<number[]>([]);
// child line animation handlers (API handles the data changes)
const { onLineCollapsed, onLineExpanded } = useLineEventHandlers();

// task UI handlers moved to module
const { setTaskToEdit, editTask, clearTaskToEdit, closeTaskPanel } = useTaskUiHandlers({
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
let organiserSyncNowHandler: any = null;
let organiserSyncFullHandler: any = null;
let organiserGroupMergeOpenHandler: any = null;
let headerDevicesInterval: ReturnType<typeof setInterval> | null = null;

const DEVICE_PROBE_SLOW_MS = 1000;
const deviceProbeChecking = ref<Record<string, boolean>>({});
const headerDeviceProbeDone = ref(false);

function resolveConnectionStatus(
  deviceId: string,
  peer: SyncPeerRecord | undefined,
): DeviceConnectionStatus {
  if (deviceProbeChecking.value[deviceId]) return 'checking';
  if (!headerDeviceProbeDone.value) return 'checking';
  return peer?.peerInRange === true ? 'connected' : 'disconnected';
}

async function refreshHeaderDeviceStatus(): Promise<void> {
  try {
    const [devices, peers] = await Promise.all([loadConnectionsDevices(), loadSyncPeerStates()]);
    const peerMap = new Map(peers.map((p) => [String(p.peerDeviceId), p]));
    const remotes = (devices || []).filter((d: any) => !d?.isLocal);
    headerDeviceStatus.value = remotes.map((d: any) => {
      const id = String(d.id);
      const status = resolveConnectionStatus(id, peerMap.get(id));
      return buildDeviceStatusRow(
        { id, name: String(d.name || d.id || "") },
        status,
      );
    });
  } catch {
    void 0;
  }
}

async function probeOneDeviceForStrip(device: ConnectedDevice): Promise<void> {
  const id = String(device.id);
  const slowTimer = setTimeout(() => {
    deviceProbeChecking.value = { ...deviceProbeChecking.value, [id]: true };
    void refreshHeaderDeviceStatus();
  }, DEVICE_PROBE_SLOW_MS);
  try {
    if (String(device.lanHost || "").trim()) {
      await probeLanPeerInfo(device);
    }
  } finally {
    clearTimeout(slowTimer);
    const next = { ...deviceProbeChecking.value };
    delete next[id];
    deviceProbeChecking.value = next;
    await refreshHeaderDeviceStatus();
  }
}

async function probeHeaderDeviceStrip(opts?: { launch?: boolean }): Promise<void> {
  if (opts?.launch) headerDeviceProbeDone.value = false;
  try {
    const devices = await loadConnectionsDevices();
    const remotes = devices.filter((d) => !d.isLocal);
    await refreshHeaderDeviceStatus();
    await Promise.all(remotes.map((d) => probeOneDeviceForStrip(d)));
  } catch {
    void 0;
  } finally {
    headerDeviceProbeDone.value = true;
    await refreshHeaderDeviceStatus();
  }
}

// Register cleanup synchronously during setup so lifecycle hook is valid
onBeforeUnmount(() => {
  window.removeEventListener("co21:todo-schedule-open", onTodoScheduleOpen);
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
    if (organiserSyncNowHandler)
      window.removeEventListener(
        "organiser:sync-now",
        organiserSyncNowHandler as EventListener
      );
    if (organiserSyncFullHandler)
      window.removeEventListener(
        "organiser:sync-full",
        organiserSyncFullHandler as EventListener
      );
    if (organiserGroupMergeOpenHandler)
      window.removeEventListener(
        "group:merge-open",
        organiserGroupMergeOpenHandler as EventListener
      );
  } catch (e) {
    // ignore
  }
  stopSyncScheduler();
  if (headerDevicesInterval) {
    clearInterval(headerDevicesInterval);
    headerDevicesInterval = null;
  }
});

function triggerCalendarSync() {
  try {
    const cur = CC.task.time.currentDate?.value;
    if (!cur) return;
    const d = new Date(cur);
    const from = new Date(d);
    from.setMonth(from.getMonth() - 3);
    const to = new Date(d);
    to.setMonth(to.getMonth() + 3);
    const fmt = (dt: Date) => dt.toISOString().slice(0, 10);
    void checkAndSync(fmt(from), fmt(to));
  } catch {
    void 0;
  }
}

// Trigger calendar sync when navigating dates
watch(
  () => CC.task.time.currentDate.value,
  () => { triggerCalendarSync(); },
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
              CC.task.list && typeof CC.task.list.items === "function"
                ? CC.task.list.items()
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
} = useCalendarHandlers({
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
  task: CC.task,
  group: CC.group,
});

// group options, activeGroupOptions and groupTree are provided by createTaskComputed

// Return weekday and compact date (e.g., "Tuesday, 23.12.2025")
const formatDateOnly = (date: string) => formatDisplayDate(date);

const formatHeaderDate = (date: string): string =>
  formatDisplayDate(date, {
    monthStyle: "short",
    weekdayStyle: "long",
    uppercaseDate: true,
    uppercaseWeekday: true,
    uppercaseRelative: true,
    ...($q.screen.lt.md
      ? {
          relativeMaxLength: 4,
          weekdayStyle: "short" as const,
        }
      : {}),
  });

const getGroupName = (groupId?: string): string => {
  if (!groupId) return "Unknown";
  const group = CC.group.list.all.value.find((g: Group) => g.id === groupId);
  return group ? resolveLocalGroupName(group) : "Unknown";
};

const activeGroupWatermarkLabel = computed(() => {
  const active = CC.group.active.activeGroup.value;
  const id = String(active?.value ?? "").trim();
  if (!id) return "";
  const group = CC.group.list.all.value.find((g: Group) => String(g.id) === id);
  return group ? resolveLocalGroupName(group) : active?.label || id;
});

async function onHeaderManualSync(): Promise<void> {
  await runHeaderSync(false);
}

async function onHeaderFullSync(): Promise<void> {
  await runHeaderSync(true);
}

async function runHeaderSync(forceFullSync: boolean): Promise<void> {
  if (headerSyncRunning.value) return;
  headerSyncRunning.value = true;
  try {
    const contract = await loadActiveContractForSync();
    if (!contract) {
      $q.notify({ type: "warning", message: $text("sync.contract_pending_short") });
      return;
    }

    const devices = await loadConnectionsDevices();
    const remotes = devices.filter((d) => !d.isLocal && !!String(d.lanHost || "").trim());
    if (!remotes.length) {
      $q.notify({ type: "warning", message: $text("sync.lan_delivery_failed") });
      return;
    }

    const activeGroupId = String(CC.group.active.activeGroup.value?.value || "").trim();
    const groups = (CC.group.list.all.value || []).map((g: any) => ({
      id: String(g.id),
      name: String(g.name || g.id || ""),
      parentId: g.parentId ?? g.parent_id ?? null,
    }));
    const profiles = await loadRoleProfiles();
    const snapshotById = new Map(
      contract.devices.map((d) => [normalizeDeviceId(d.id), d.rolesByGroup || {}]),
    );

    const allowedPeers = remotes.filter((d) => {
      const mergedRoles = snapshotById.get(normalizeDeviceId(d.id)) ?? d.rolesByGroup ?? {};
      if (!activeGroupId) return Object.keys(mergedRoles).length > 0;
      const resolved = resolveEffectiveRole(
        { ...d, rolesByGroup: { ...mergedRoles } },
        groups,
        profiles,
        activeGroupId,
      );
      return !!resolved;
    });

    if (!allowedPeers.length) {
      $q.notify({ type: "info", message: $text("sync.contract_no_access") });
      return;
    }

    await probeHeaderDeviceStrip();

    let ok = 0;
    for (const peer of allowedPeers) {
      const success = await runSyncWithPeer({
        peerDeviceId: peer.id,
        peerDeviceName: peer.name || peer.id,
        lanHost: String(peer.lanHost || ""),
        forceFullSync,
      });
      if (success) ok += 1;
    }
    await refreshHeaderDeviceStatus();
    const fail = allowedPeers.length - ok;
    $q.notify({
      type: fail ? "warning" : "positive",
      message: fail
        ? `${$text(forceFullSync ? "sync.full_sync_now" : "accounts.sync_now")}: ${ok}/${allowedPeers.length}`
        : `${$text(forceFullSync ? "sync.full_sync_now" : "accounts.sync_now")}: ${ok}/${allowedPeers.length}`,
    });
  } catch (e) {
    logger.error("header manual sync failed", e);
    $q.notify({ type: "negative", message: $text("sync.pending_action_run_fail") });
  } finally {
    headerSyncRunning.value = false;
  }
}

const mergeSourceGroup = computed(() => {
  const activeId = String(CC.group.active.activeGroup.value?.value || "").trim();
  if (!activeId) return null;
  return (CC.group.list.all.value || []).find((g: any) => String(g.id) === activeId) || null;
});
const canMergeCurrentGroup = computed(() => !!mergeSourceGroup.value);
const mergeSourceLabel = computed(() =>
  mergeSourceGroup.value ? resolveLocalGroupName(mergeSourceGroup.value) : ""
);
const mergeTargetOptions = computed(() => {
  const sourceId = String(mergeSourceGroup.value?.id || "");
  return (CC.group.list.all.value || [])
    .filter((g: any) => String(g.id) !== sourceId)
    .map((g: any) => ({ label: resolveLocalGroupName(g), value: String(g.id) }))
    .sort((a: any, b: any) => String(a.label).localeCompare(String(b.label), undefined, { sensitivity: "base" }));
});
const mergeTargetTree = computed(() => {
  const sourceId = String(mergeSourceGroup.value?.id || "");
  const prune = (nodes: any[]): any[] =>
    (nodes || [])
      .filter((n: any) => String(n.id) !== sourceId)
      .map((n: any) => ({
        ...n,
        children: prune(n.children || []),
      }));
  return prune((CC.group.list.tree.value || []) as any[]);
});
const mergeTargetLabel = computed(() => {
  const id = String(mergeTargetGroupId.value || "");
  const opt = mergeTargetOptions.value.find((o: any) => String(o.value) === id);
  return opt?.label || "";
});

function onMergeTargetTreeSelect(v: string[] | string | null): void {
  const key = Array.isArray(v) ? v[0] : v;
  mergeTargetGroupId.value = key ? String(key) : null;
}

function openGroupMergeDialog(): void {
  if (!mergeSourceGroup.value) return;
  mergeTargetGroupId.value = String(mergeTargetOptions.value[0]?.value || "") || null;
  showGroupMergeDialog.value = true;
}

async function confirmGroupMerge(): Promise<void> {
  const source = mergeSourceGroup.value;
  const sourceId = String(source?.id || "").trim();
  const targetId = String(mergeTargetGroupId.value || "").trim();
  if (!sourceId || !targetId || sourceId === targetId || mergeRunning.value) return;
  mergeRunning.value = true;
  try {
    const days = CC.task.time.days.value || {};
    for (const [, day] of Object.entries(days)) {
      if (!day || !Array.isArray(day.tasks)) continue;
      for (const task of day.tasks) {
        const gid = String(task?.groupId ?? task?.group_id ?? "");
        if (gid !== sourceId) continue;
        task.groupId = targetId;
        if ("group_id" in task) task.group_id = targetId;
        task.updatedAt = Date.now();
      }
    }
    await saveData();
    await CC.group.delete(sourceId);
    const targetGroup = (CC.group.list.all.value || []).find((g: any) => String(g.id) === targetId);
    if (targetGroup) CC.group.active.set(targetGroup);
    else CC.group.active.setById(targetId);
    showGroupMergeDialog.value = false;
    $q.notify({ type: "positive", message: $text("group.merge_done") });
  } catch (e) {
    logger.error("group merge failed", e);
    $q.notify({ type: "negative", message: $text("sync.pending_action_run_fail") });
  } finally {
    mergeRunning.value = false;
  }
}

// Color/style computeds derived from the active group
const { activeGroupColor, headerStyle, cardStyle, watermarkTextColor } = useGroupColor(
  CC.group.list.all,
  CC.group.active.activeGroup
);

// Extract add/update handlers into a task CRUD module
const { handleAddTask, handleUpdateTask } = useTaskCrud({
  setCurrentDate: CC.task.time.setCurrentDate,
  activeGroup: CC.group.active.activeGroup,
  currentDate: CC.task.time.currentDate,
  allTasks,
  quasar: $q,
  active: CC.task.active,
});

const handleAddTaskFromForm = async (taskPayload: any, opts?: { preview?: boolean }) => {
  const shouldPreview = $q.screen.lt.md ? false : Boolean(opts?.preview);
  await handleAddTask(taskPayload, { preview: shouldPreview });

  // Mobile flow: after creating task, close the creation panel instead of opening preview.
  if ($q.screen.lt.md) {
    try {
      setPreviewFloating(null);
    } catch (e) {
      void e;
    }
    panelHidden.value = true;
  }
};

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
    const wasActive =
      CC.task.active.task.value && String(CC.task.active.task.value.id) === String(id);
    await CC.task.delete(date, id);
    if (wasActive) {
      closeTaskPanel();
      try {
        closeFloatingPreview();
      } catch (e) {
        void e;
      }
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
        if (
          (target as Element).closest(".q-menu, .q-dialog, .q-popup-proxy, .q-tooltip")
        ) {
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
const addFormDefaultTypeId = ref<'Todo' | 'TimeEvent'>('Todo');
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

function onCalendarSelectedDate(d: string) {
  try {
    CC.task.time.setCurrentDate(d);
  } catch {
    void 0;
  }
  if (todoScheduleActive.value) {
    pickTodoScheduleDay(d);
  }
}

function scrollToCalendarSection() {
  try {
    calendarSectionRef.value?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch {
    void 0;
  }
}

function cancelTodoSchedule() {
  cancelTodoScheduleState();
}

async function confirmTodoSchedule(goToEdit: boolean) {
  const task = todoScheduleSourceTask.value;
  const date = todoSchedulePickedDate.value.trim();
  if (!task?.id || !date) return;
  const updated = {
    ...task,
    type_id: "TimeEvent",
    type: "event",
    date,
    eventDate: date,
    eventTime: buildTodoScheduleEventTime(),
    timeMode: "event",
  };
  try {
    await handleUpdateTask(updated);
    cancelTodoScheduleState();
    try {
      CC.task.time.setCurrentDate(date);
    } catch {
      void 0;
    }
    panelHidden.value = false;
    if (goToEdit) {
      try {
        CC.task.active.mode.value = "edit";
      } catch {
        void 0;
      }
    }
  } catch {
    void 0;
  }
}

function onTodoScheduleOpen() {
  scrollToCalendarSection();
  panelHidden.value = true;
}

async function onCalendarDayClick(payload: { date: string; rect: DOMRect | null }) {
  try {
    if (todoScheduleActive.value) {
      const date = payload?.date || CC.task.time.currentDate.value;
      pickTodoScheduleDay(date);
      try {
        CC.task.time.setCurrentDate(date);
      } catch {
        void 0;
      }
      return;
    }
    lastAddFromCalendar.value = true;
    addFormDefaultTypeId.value = 'TimeEvent';
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
    addFormDefaultTypeId.value = 'Todo';

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
    addFormDefaultTypeId.value = 'Todo';

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
    const id = task.id;
    if (!id) return;
    await CC.task.status.toggleComplete(date, id);
  } catch (e) {
    // ignore
  }
};

provide(dayOrganiserPanelKey, {
  panelHidden,
  previewFloating,
  previewRect,
  computePreviewStyle,
  filteredParentOptions,
  allTasks,
  replenishTasks,
  newTask,
  animatingLines,
  onLineCollapsed,
  onLineExpanded,
  getGroupName,
  clearTaskToEdit,
  handleDeleteTask: (payload) => void handleDeleteTask(payload),
  handleUpdateTask: (task) => void handleUpdateTask(task),
  handleAddTaskFromForm: (taskPayload, opts) =>
    void handleAddTaskFromForm(taskPayload, opts),
  handleToggleStatus: (task) => void handleToggleStatus(task),
  handleCalendarDateSelect,
  filterParentTasks,
  addFormDefaultTypeId,
  CC,
} as DayOrganiserPanelContext);

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
  window.addEventListener("co21:todo-schedule-open", onTodoScheduleOpen);
  try {
    await CC.storage.loadData();
    try {
      CC.task.refreshFlatListFromDays();
    } catch (e) {
      void e;
    }
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
    reloadKey.value += 1;
  } catch (error) {
    logger.error("Failed to load data on mount:", error);
  } finally {
    organiserReady.value = true;
    scheduleBackgroundLanSyncAfterDisplay();
    triggerCalendarSync();
    startSyncScheduler();
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
      // After midnight: advance yesterday → today only (keep historical navigation).
      const todayStr = todayString();
      const curStr = String(CC.task.time.currentDate?.value || "");
      if (curStr && curStr === yesterdayString()) {
        try {
          CC.task.time.setCurrentDate(todayStr);
        } catch (e) {
          // ignore
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
    const detail = (e as CustomEvent<{ groupId?: string; parentId?: string | null }>).detail;
    const groupId = detail?.groupId ?? null;
    const parentId = detail?.parentId ?? null;
    openGroupEditDialog(groupId, parentId);
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

  organiserSyncNowHandler = () => {
    void onHeaderManualSync();
  };
  window.addEventListener("organiser:sync-now", organiserSyncNowHandler as EventListener);

  organiserSyncFullHandler = () => {
    void onHeaderFullSync();
  };
  window.addEventListener("organiser:sync-full", organiserSyncFullHandler as EventListener);

  organiserGroupMergeOpenHandler = () => {
    openGroupMergeDialog();
  };
  window.addEventListener("group:merge-open", organiserGroupMergeOpenHandler as EventListener);

  void probeHeaderDeviceStrip({ launch: true });
  headerDevicesInterval = setInterval(() => {
    void probeHeaderDeviceStrip();
  }, 15000);

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

.task-header-row {
  width: 100%;
  justify-content: flex-end;
  gap: 8px;
}

/* Tighter space between chevrons and date label (margin/padding only — no font changes). */
.task-header-date-nav {
  gap: 4px;
  flex-shrink: 0;
}

.task-header-sync-tools {
  gap: 2px;
  flex-shrink: 0;
}

.task-header-v-separator {
  width: 1px;
  height: 22px;
  margin-left: 4px;
  background: color-mix(in srgb, currentColor 45%, transparent);
  opacity: 0.75;
}

.task-header-device-strip {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  max-width: 36%;
  padding-bottom: 2px;
  scrollbar-width: thin;
}

.task-header-device-pill {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 5px;
  border-radius: 0;
  padding: 3px 6px;
  min-width: 52px;
  font-size: 9px;
  line-height: 1.05;
  border: 1px solid rgba(0, 0, 0, 0.12);
  flex-shrink: 0;
  background: #fff;
}

.task-header-device-pill__labels {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 1px;
  min-width: 0;
}

.task-header-device-pill__line {
  font-weight: 700;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.task-header-device-pill__link {
  flex-shrink: 0;
}

.task-header-device-pill--on {
  background: #dcfce7;
  border-color: #16a34a;
  color: #14532d;
}

.task-header-device-pill--on :deep(.q-icon) {
  color: #14532d !important;
}

.task-header-device-pill--off {
  background: #fff;
  border-color: #991b1b;
  color: #7f1d1d;
}

.task-header-device-pill--off :deep(.q-icon) {
  color: #7f1d1d !important;
}

.task-header-device-pill--checking {
  background: #dbeafe;
  border-color: #2563eb;
  color: #1d4ed8;
}

.task-header-device-pill--checking :deep(.q-icon) {
  color: #1d4ed8 !important;
}

.task-header-device-pill--checking .task-header-device-pill__link {
  animation: task-header-device-spin 1.1s linear infinite;
}

@keyframes task-header-device-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.task-header-date-nav .task-header-date-btn {
  margin: 0 !important;
  min-width: 0 !important;
  min-height: 0 !important;
  width: auto !important;
  height: auto !important;
  padding: 0 !important;
}

.task-header-date-nav .task-header-date-btn :deep(.q-btn__wrapper) {
  min-width: 0 !important;
  min-height: 0 !important;
  padding: 0 2px !important;
}

.task-header-date-nav .task-header-date-btn :deep(.q-btn__content) {
  padding: 0 !important;
}

@media (max-width: 767px) {
  .list-add-btn {
    display: none !important;
  }

  .task-header-row {
    justify-content: space-between;
    flex-wrap: nowrap;
    gap: 6px;
    align-items: center;
  }

  .task-header-sync-tools {
    display: none !important;
  }

  .task-header-date-nav {
    flex: 1 1 0;
    min-width: 0;
    justify-content: center;

    .text-weight-bold {
      font-size: 0.92rem;
      line-height: 1;
      white-space: nowrap;
    }
  }

  .task-header-group-select {
    flex: 1 1 0;
    min-width: 0;
    justify-content: center;
    width: auto;
  }
}
</style>

<style lang="scss" src="../css/day-organiser-page.scss"></style>
