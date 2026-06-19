<template>
  <div
    class="fixed-content"
    :class="{ floating: ctx.previewFloating.value }"
    :style="ctx.previewFloating.value ? ctx.computePreviewStyle(ctx.previewRect.value) : {}"
  >
    <q-btn
      v-if="!ctx.panelHidden.value && !$q.screen.lt.md"
      unelevated
      color="dark"
      class="panel-toggle-btn"
      :label="$text('ui.hide')"
      icon="keyboard_arrow_down"
      @click="ctx.panelHidden.value = true"
    />
    <q-btn
      v-if="!ctx.panelHidden.value && $q.screen.lt.md"
      round
      dense
      unelevated
      color="dark"
      class="panel-close-btn"
      icon="close"
      @click="ctx.panelHidden.value = true"
    />

    <TaskPreview
      v-if="
        !ctx.isFilesMode.value &&
        ctx.CC.task.active.mode.value === 'preview' &&
        ctx.CC.task.active.task.value
      "
      :task="ctx.CC.task.active.task.value"
      :group-name="ctx.getGroupName(ctx.CC.task.active.task.value.groupId)"
      :animating-lines="ctx.animatingLines.value"
      @line-collapsed="ctx.onLineCollapsed"
      @line-expanded="ctx.onLineExpanded"
      @edit="() => { const t = ctx.CC.task.active.task.value; if (t) ctx.enterTaskEdit(t); }"
      @close="ctx.clearTaskToEdit"
      @delete-task="ctx.handleDeleteTask"
      @update-task="(t) => ctx.handleUpdateTask(t)"
      :fixed="ctx.previewFloating.value"
    />

    <div
      class="floating-preview-wrapper"
      :class="{ floating: ctx.previewFloating.value }"
      v-if="ctx.CC.task.active.mode.value === 'add' || ctx.CC.task.active.mode.value === 'edit'"
    >
      <AddTaskForm
        :filtered-parent-options="ctx.filteredParentOptions.value"
        :active-group="ctx.CC.group.active.activeGroup.value"
        :show-calendar="false"
        :selected-date="ctx.newTask.value.eventDate"
        :all-tasks="ctx.allTasks.value"
        :replenish-tasks="ctx.replenishTasks.value"
        :initial-task="ctx.CC.task.active.task.value"
        :mode="ctx.CC.task.active.mode.value"
        :default-add-type-id="ctx.addFormDefaultTypeId.value"
        :media-mode="ctx.isFilesMode.value"
        @update:mode="(v) => ctx.CC.task.active.setMode(v)"
        @add-task="ctx.handleAddTaskFromForm"
        @update-task="ctx.handleUpdateTask"
        @delete-task="ctx.handleDeleteTask"
        @toggle-status="ctx.handleToggleStatus"
        @cancel-edit="() => ctx.clearTaskToEdit()"
        @calendar-date-select="ctx.handleCalendarDateSelect"
        @filter-parent-tasks="ctx.filterParentTasks"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject } from "vue";
import { useQuasar } from "quasar";
import { $text } from "src/modules/lang";
import AddTaskForm from "src/modules/task/components/element/AddTaskForm.vue";
import TaskPreview from "src/modules/task/components/element/TaskPreview.vue";
import { dayOrganiserPanelKey } from "src/pages/dayOrganiserPanelKey";

const $q = useQuasar();
const ctx = inject(dayOrganiserPanelKey);
if (!ctx) {
  throw new Error("DayOrganiserTaskPanelContent requires dayOrganiserPanelKey provider");
}
</script>
