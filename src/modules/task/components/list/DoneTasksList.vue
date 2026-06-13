<template>
  <q-card
    v-if="!listOnly"
    flat
    class="q-pa-sm q-mb-md"
    style="background: transparent; border-radius: 8px"
  >
    <q-btn
      unelevated
      dense
      no-caps
      class="done-toggle-btn"
      @click="isExpanded = !isExpanded"
    >
      <template #default>
        <div class="row items-center full-width justify-between" style="gap: 8px">
          <div class="row items-center" style="gap: 8px">
            <q-icon name="check" color="grey-7" />
            <div class="text-subtitle2">
              <strong>{{ $text("action.done") }} ({{ doneCount }})</strong>
            </div>
          </div>
          <div class="text-subtitle2">
            <q-icon :name="isExpanded ? 'expand_less' : 'expand_more'" color="grey-7" />
          </div>
        </div>
      </template>
    </q-btn>
    <div
      v-if="isExpanded"
      class="q-mt-sm done-items-grid"
      :class="{ 'done-items-grid--dialog': dialogLayout }"
    >
      <DoneTaskRow
        v-for="d in props.doneTasks"
        :key="d.id"
        :task="d"
        @select="onDoneClick"
      />
    </div>
  </q-card>
  <div
    v-else
    class="done-items-grid"
    :class="{ 'done-items-grid--dialog': dialogLayout }"
  >
    <p v-if="!doneCount" class="text-grey-6 q-ma-none">{{ $text("ui.no_done_tasks") }}</p>
    <DoneTaskRow
      v-for="d in props.doneTasks"
      :key="d.id"
      :task="d"
      @select="onDoneClick"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import CC from "src/CCAccess";
import { $text } from "src/modules/lang";
import DoneTaskRow from "./DoneTaskRow.vue";

const props = withDefaults(
  defineProps<{
    doneTasks: any[];
    /** Render only the task grid (e.g. inside a dialog). */
    listOnly?: boolean;
    /** Wider layout for fullscreen dialog. */
    dialogLayout?: boolean;
  }>(),
  {
    listOnly: false,
    dialogLayout: false,
  },
);

const isExpanded = ref(false);
const doneCount = computed(() => (props.doneTasks || []).length);

async function onDoneClick(task: any) {
  try {
    const date = task?.date || task?.eventDate || "";
    const id = task.id;
    const hasCycleDone =
      Array.isArray(task?.history) &&
      task.history.some((h: any) => h && h.type === "cycleDone" && h.date === date);
    if (hasCycleDone) {
      await CC.task.status.undoCycleDone(date, id);
    } else {
      await CC.task.status.toggleComplete(date, id);
    }
  } catch (e) {
    // ignore
  }
}
</script>

<style scoped>
.done-toggle-btn {
  width: 100%;
  justify-content: flex-start;
  background: #eceff1 !important;
  color: #263238 !important;
  border: 1px solid rgba(0, 0, 0, 0.12);
}

.done-items-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.done-items-grid--dialog {
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
}

@media (min-width: 900px) {
  .done-items-grid--dialog {
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  }
}
</style>
