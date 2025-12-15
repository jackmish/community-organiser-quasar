<template>
  <q-page class="q-pa-md">
    <div class="row justify-between items-center q-mb-md">
      <h4 class="q-my-none">Day Organiser</h4>
      <div class="row q-gutter-sm">
        <q-btn flat icon="folder" @click="showGroupDialog = true" label="Groups" />
        <q-btn flat icon="info" @click="showDataLocation" label="Data Location" />
        <q-btn flat icon="file_download" @click="handleExport" label="Export" />
        <q-btn flat icon="file_upload" @click="handleImport" label="Import">
          <input
            type="file"
            accept=".json"
            ref="fileInput"
            style="display: none"
            @change="onFileSelected"
          />
        </q-btn>
      </div>
    </div>

    <!-- Date Navigation -->
    <div class="row justify-center items-center q-mb-md q-gutter-sm">
      <q-btn flat round icon="chevron_left" @click="prevDay" />
      <q-btn flat @click="goToToday" label="Today" />
      <q-input
        v-model="currentDate"
        type="date"
        dense
        outlined
        @update:model-value="setCurrentDate"
      />
      <q-btn flat round icon="chevron_right" @click="nextDay" />
    </div>

    <!-- Active Group Selector -->
    <div class="row justify-center q-mb-md">
      <q-select
        v-model="activeGroup"
        :options="activeGroupOptions"
        label="Active Group"
        outlined
        dense
        style="min-width: 300px"
        @update:model-value="handleActiveGroupChange"
        :rules="[(val) => !!val || 'Please select an active group']"
      >
        <template #prepend>
          <q-icon name="folder_open" />
        </template>
      </q-select>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="text-center q-pa-lg">
      <q-spinner color="primary" size="3em" />
    </div>

    <!-- Day View -->
    <div v-else>
      <div class="row q-col-gutter-md">
        <!-- Left Column - Tasks List -->
        <div class="col-12 col-md-6">
          <q-card>
            <q-card-section>
              <div class="text-h6">Tasks for {{ formatDisplayDate(currentDate) }}</div>
            </q-card-section>
            <q-card-section v-if="currentDayData.tasks.length === 0">
              <p class="text-grey-6">No tasks for this day</p>
            </q-card-section>
            <q-list v-else separator>
              <q-item
                v-for="task in sortedTasks"
                :key="task.id"
                class="q-pa-md"
                :class="{ 'bg-grey-2': task.completed }"
              >
                <q-item-section side>
                  <q-checkbox
                    :model-value="task.completed"
                    @update:model-value="handleToggleTask(task.id)"
                  />
                </q-item-section>
                <q-item-section>
                  <q-item-label :class="{ 'text-strike': task.completed }">
                    <strong>{{ task.name }}</strong>
                  </q-item-label>
                  <q-item-label caption>{{ task.description }}</q-item-label>
                  <q-item-label caption class="q-mt-xs">
                    <q-chip
                      :color="priorityColor(task.priority)"
                      text-color="white"
                      size="sm"
                    >
                      {{ task.priority }}
                    </q-chip>
                    <q-chip
                      v-if="task.groupId"
                      :style="{ backgroundColor: getGroupColor(task.groupId) }"
                      text-color="white"
                      size="sm"
                      icon="folder"
                    >
                      {{ getGroupName(task.groupId) }}
                    </q-chip>
                  </q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-btn
                    flat
                    round
                    dense
                    icon="delete"
                    color="negative"
                    @click="handleDeleteTask(task.id)"
                  />
                </q-item-section>
              </q-item>
            </q-list>
          </q-card>
          <!-- New Panel Below Daily Tasks -->
          <q-card class="q-mt-md">
            <q-card-section>
              <div class="text-h6">New Panel</div>
              <div>
                <!-- Add your content here -->
                This is a new panel below the daily tasks.
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Right Column - Add Task & Notes -->
        <div class="col-12 col-md-6">
          <!-- Add Task Section -->
          <q-card class="q-mb-md">
            <q-card-section>
              <div class="text-h6 row items-center q-gutter-sm">
                <q-icon name="add_circle" color="positive" size="md" />
                <span>Add New Task</span>
              </div>
            </q-card-section>
            <q-card-section>
              <q-form @submit="handleAddTask" class="q-gutter-md">
                <div>
                  <div class="text-subtitle2 q-mb-sm">Type</div>
                  <q-option-group
                    v-model="newTask.type_id"
                    :options="typeOptions"
                    color="primary"
                    inline
                  />
                </div>
                <div v-if="newTask.type_id === 'TimeEvent'">
                  <q-input
                    v-model="newTask.eventDate"
                    type="date"
                    label="Event Date"
                    outlined
                    class="q-mb-md"
                  />
                  <!-- Simple Calendar View -->
                  <q-card class="q-mb-md bg-grey-1">
                    <q-card-section>
                      <div class="text-subtitle2">Calendar View</div>
                      <div class="q-mb-sm">
                        <strong>Current Week:</strong>
                        <div class="row q-gutter-xs">
                          <span
                            v-for="day in calendarCurrentWeek"
                            :key="day"
                            class="q-pa-xs"
                          >
                            <q-btn
                              size="sm"
                              :color="day === newTask.eventDate ? 'primary' : 'grey-4'"
                              @click="newTask.eventDate = day"
                              >{{ day }}</q-btn
                            >
                          </span>
                        </div>
                      </div>
                      <div class="q-mb-sm">
                        <strong>Next Week:</strong>
                        <div class="row q-gutter-xs">
                          <span
                            v-for="day in calendarNextWeek"
                            :key="day"
                            class="q-pa-xs"
                          >
                            <q-btn
                              size="sm"
                              :color="day === newTask.eventDate ? 'primary' : 'grey-4'"
                              @click="newTask.eventDate = day"
                              >{{ day }}</q-btn
                            >
                          </span>
                        </div>
                      </div>
                      <div class="row q-gutter-sm">
                        <q-btn flat color="secondary" @click="newTask.eventDate = ''"
                          >Clear</q-btn
                        >
                        <q-btn flat color="primary" @click="setEventDateToToday"
                          >Today</q-btn
                        >
                        <q-btn flat color="primary" @click="setEventDateToTomorrow"
                          >Tomorrow</q-btn
                        >
                      </div>
                    </q-card-section>
                  </q-card>
                </div>
                <div class="row q-gutter-sm">
                  <q-input
                    v-model="newTask.name"
                    label="Own task name"
                    outlined
                    class="col"
                  />
                  <q-input
                    :model-value="autoGeneratedName"
                    label="Automatic name from description"
                    outlined
                    readonly
                    class="col"
                    bg-color="grey-2"
                  />
                </div>
                <q-input
                  v-model="newTask.description"
                  label="Description"
                  outlined
                  type="textarea"
                  rows="2"
                />
                <div>
                  <div class="text-subtitle2 q-mb-sm">Priority</div>
                  <q-option-group
                    v-model="newTask.priority"
                    :options="priorityOptions"
                    type="radio"
                    color="primary"
                    inline
                  />
                </div>
                <div class="row items-center justify-center">
                  <q-btn type="submit" color="primary" label="Add Task" />
                  <div
                    v-if="activeGroup && activeGroup.value"
                    class="text-caption text-grey-7 q-ml-md"
                  >
                    <q-icon name="info" size="xs" class="q-mr-xs" />
                    Task will be added to:
                    <strong>{{ activeGroup.label.split(" (")[0] }}</strong>
                  </div>
                  <div v-else class="text-caption text-warning q-ml-md">
                    <q-icon name="warning" size="xs" class="q-mr-xs" />
                    Please select an active group (not "All Groups")
                  </div>
                </div>
              </q-form>
            </q-card-section>
          </q-card>

          <!-- Day Notes -->
          <q-card>
            <q-card-section>
              <div class="text-h6">Notes</div>
            </q-card-section>
            <q-card-section>
              <q-input
                :model-value="currentDayData.notes"
                @update:model-value="handleUpdateNotes"
                type="textarea"
                outlined
                rows="4"
                placeholder="Add notes for this day..."
              />
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <!-- Group Management Dialog -->
    <q-dialog v-model="showGroupDialog">
      <q-card style="min-width: 500px">
        <q-card-section>
          <div class="text-h6">Manage Groups</div>
        </q-card-section>

        <q-card-section>
          <q-form @submit.prevent="handleAddGroup" class="q-mb-md">
            <div class="row q-gutter-sm">
              <q-input
                v-model="newGroupName"
                label="Group Name"
                outlined
                dense
                class="col"
              />
              <q-select
                v-model="newGroupParent"
                :options="groupOptions"
                label="Parent Group (optional)"
                outlined
                dense
                clearable
                class="col"
              />
              <q-input
                v-model="newGroupColor"
                label="Color"
                outlined
                dense
                style="max-width: 80px"
              >
                <template #append>
                  <input
                    v-model="newGroupColor"
                    type="color"
                    style="width: 40px; height: 30px; border: none; cursor: pointer"
                  />
                </template>
              </q-input>
              <q-btn type="submit" color="primary" icon="add" dense />
            </div>
          </q-form>

          <q-tree :nodes="groupTree" node-key="id" default-expand-all>
            <template #default-header="prop">
              <div class="row items-center full-width">
                <q-icon
                  :name="prop.node.icon || 'folder'"
                  :color="prop.node.color"
                  class="q-mr-sm"
                />
                <span>{{ prop.node.label }}</span>
                <q-space />
                <q-btn
                  flat
                  dense
                  round
                  icon="delete"
                  size="sm"
                  @click.stop="handleDeleteGroup(prop.node.id)"
                />
              </div>
            </template>
          </q-tree>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Close" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- First Run Dialog -->
    <FirstRunDialog v-model="showFirstRunDialog" @create="handleFirstGroupCreation" />
  </q-page>
</template>

<script setup lang="ts">
import { format, addDays, startOfWeek } from "date-fns";

const getWeekDays = (startDate: Date) => {
  return Array.from({ length: 7 }, (_, i) => format(addDays(startDate, i), "yyyy-MM-dd"));
};
const today = new Date();
const calendarCurrentWeek = computed(() =>
  getWeekDays(startOfWeek(today, { weekStartsOn: 1 }))
);
const calendarNextWeek = computed(() =>
  getWeekDays(addDays(startOfWeek(today, { weekStartsOn: 1 }), 7))
);
function setEventDateToToday() {
  newTask.value.eventDate = format(today, "yyyy-MM-dd");
}
function setEventDateToTomorrow() {
  newTask.value.eventDate = format(addDays(today, 1), "yyyy-MM-dd");
}
import { ref, computed, onMounted } from "vue";
import { useQuasar } from "quasar";
import { useDayOrganiser } from "../modules/day-organiser";
import type { Task, TaskDuration, TaskGroup } from "../modules/day-organiser";
import FirstRunDialog from "../components/FirstRunDialog.vue";

const $q = useQuasar();

const {
  isLoading,
  currentDate,
  currentDayData,
  loadData,
  addTask,
  deleteTask,
  toggleTaskComplete,
  updateDayNotes,
  exportData,
  importData,
  setCurrentDate,
  goToToday,
  nextDay,
  prevDay,
  groups,
  addGroup,
  deleteGroup,
  getGroupsByParent,
} = useDayOrganiser();

const fileInput = ref<HTMLInputElement | null>(null);
const showGroupDialog = ref(false);
const showFirstRunDialog = ref(false);
const newGroupName = ref("");
const newGroupParent = ref<string | undefined>(undefined);
const newGroupColor = ref("#1976d2");
const defaultGroupId = ref<string | undefined>(undefined);
const activeGroup = ref<{ label: string; value: string | null } | null>(null);

const newTask = ref({
  name: "",
  description: "",
  type_id: "Note/Later",
  status_id: "",
  parent_id: null as string | null,
  created_by: "",
  priority: "medium" as Task["priority"],
  completed: false,
  groupId: undefined as string | undefined,
  eventDate: "",
});

const typeOptions = [
  { label: "Note/Later", value: "Note/Later" },
  { label: "TimeEvent", value: "TimeEvent" },
  { label: "Replenishment", value: "Replenishment" },
];

const priorityOptions = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
];

const sortedTasks = computed(() => {
  // Filter tasks by active group (unless "All Groups" is selected)
  let tasksToSort = currentDayData.value.tasks;
  if (activeGroup.value && activeGroup.value.value !== null) {
    tasksToSort = tasksToSort.filter((task) => task.groupId === activeGroup.value!.value);
  }

  return [...tasksToSort].sort((a, b) => {
    // Sort by priority first (high -> medium -> low)
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const priorityCompare = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityCompare !== 0) return priorityCompare;
    // If priorities are equal, keep original order
    return 0;
  });
});

// Auto-generate name from description
const autoGeneratedName = computed(() => {
  if (!newTask.value.description) return "";

  // Take first sentence or first 50 characters
  const desc = newTask.value.description.trim();
  const firstSentence = desc.split(/[.!?]/)[0] || "";
  const name =
    firstSentence.length > 50 ? firstSentence.substring(0, 50) + "..." : firstSentence;

  return name || desc.substring(0, 50) + (desc.length > 50 ? "..." : "");
});

// Group options for select
const groupOptions = computed(() => {
  return groups.value.map((g) => ({
    label: g.name,
    value: g.id,
  }));
});

// Active group options with "All Groups" and task counts
const activeGroupOptions = computed(() => {
  const allTasks = currentDayData.value.tasks;
  const totalTaskCount = allTasks.length;

  const options = [
    {
      label: `All Groups (${totalTaskCount})`,
      value: null,
    },
    ...groups.value.map((g) => {
      const taskCount = allTasks.filter((t) => t.groupId === g.id).length;
      return {
        label: `${g.name} (${taskCount})`,
        value: g.id,
      };
    }),
  ];

  return options;
});

// Build group tree for display
const groupTree = computed(() => {
  const buildTree = (parentId?: string): any[] => {
    return getGroupsByParent(parentId).map((group) => ({
      id: group.id,
      label: group.name,
      color: group.color,
      icon: "folder",
      children: buildTree(group.id),
    }));
  };
  return buildTree();
});

const formatDisplayDate = (date: string) => {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const priorityColor = (priority: Task["priority"]) => {
  const colors = {
    low: "blue",
    medium: "orange",
    high: "red",
  };
  return colors[priority];
};

const getGroupName = (groupId: string): string => {
  const group = groups.value.find((g) => g.id === groupId);
  return group ? group.name : "Unknown";
};

const getGroupColor = (groupId: string): string => {
  const group = groups.value.find((g) => g.id === groupId);
  return group?.color || "#1976d2";
};

const handleAddTask = async () => {
  // Check if active group is selected (and not "All Groups")
  if (!activeGroup.value || activeGroup.value.value === null) {
    $q.notify({
      type: "warning",
      message: 'Please select an active group first (not "All Groups")',
      position: "top",
    });
    return;
  }

  // Use auto-generated name if custom name is empty
  const finalName = newTask.value.name || autoGeneratedName.value;

  if (!finalName) return;

  const taskData: any = {
    ...newTask.value,
    name: finalName,
    date: currentDate.value,
    // Auto-assign to active group
    groupId: activeGroup.value.value,
  };

  await addTask(currentDate.value, taskData);

  // Reset form
  newTask.value = {
    name: "",
    description: "",
    type_id: "Note/Later",
    status_id: "",
    parent_id: null,
    created_by: "",
    priority: "medium",
    completed: false,
    groupId: undefined,
    eventDate: "",
  };
};

const handleDeleteTask = async (taskId: string) => {
  await deleteTask(currentDate.value, taskId);
};

const handleToggleTask = async (taskId: string) => {
  await toggleTaskComplete(currentDate.value, taskId);
};

const handleActiveGroupChange = (
  value: { label: string; value: string | null } | null
) => {
  activeGroup.value = value;
};

const handleUpdateNotes = async (notes: string | number | null) => {
  if (notes !== null && notes !== undefined) {
    await updateDayNotes(currentDate.value, String(notes));
  }
};

const handleExport = () => {
  exportData();
};

const handleImport = () => {
  fileInput.value?.click();
};

const onFileSelected = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    try {
      await importData(file);
    } catch (error) {
      console.error("Import failed:", error);
    }
  }
};

const handleAddGroup = async () => {
  if (!newGroupName.value.trim()) return;

  const group = await addGroup(
    newGroupName.value,
    newGroupParent.value,
    newGroupColor.value
  );

  // Set as default and active if it's the first group
  if (!defaultGroupId.value) {
    defaultGroupId.value = group.id;
    activeGroup.value = {
      label: group.name,
      value: group.id,
    };
  }

  // Reset form
  newGroupName.value = "";
  newGroupParent.value = undefined;
  newGroupColor.value = "#1976d2";
};

const handleFirstGroupCreation = async (data: { name: string; color: string }) => {
  const group = await addGroup(data.name, undefined, data.color);
  defaultGroupId.value = group.id;
  activeGroup.value = {
    label: group.name,
    value: group.id,
  };
  showFirstRunDialog.value = false;
};

const handleDeleteGroup = async (groupId: string) => {
  await deleteGroup(groupId);

  // If deleted group was the active one, set a new active group
  if (activeGroup.value?.value === groupId) {
    if (groups.value.length > 0) {
      const firstGroup = groups.value[0];
      if (firstGroup) {
        activeGroup.value = {
          label: firstGroup.name,
          value: firstGroup.id,
        };
        defaultGroupId.value = firstGroup.id;
      }
    } else {
      activeGroup.value = null;
      defaultGroupId.value = undefined;
    }
  }

  // If deleted group was the default, set a new default
  if (defaultGroupId.value === groupId && groups.value.length > 0) {
    defaultGroupId.value = groups.value[0]?.id;
  } else if (groups.value.length === 0) {
    defaultGroupId.value = undefined;
  }
};

const showDataLocation = async () => {
  if (window.electronAPI) {
    const appDataPath = await window.electronAPI.getAppDataPath();
    const dataFile = window.electronAPI.joinPath(appDataPath, "organiser-data.json");

    $q.dialog({
      title: "Data Storage Location",
      message: `Your data is automatically saved to:\n\n${dataFile}`,
      html: true,
      ok: {
        label: "Close",
        color: "primary",
      },
    });
  } else {
    $q.notify({
      message: "Running in web mode - data is stored in browser localStorage",
      color: "info",
      position: "top",
    });
  }
};

onMounted(async () => {
  await loadData();

  // Show first run dialog if no groups exist
  if (groups.value.length === 0) {
    showFirstRunDialog.value = true;
  } else {
    // Auto-select first group as active if groups exist
    const firstGroup = groups.value[0];
    if (firstGroup && !activeGroup.value) {
      activeGroup.value = {
        label: firstGroup.name,
        value: firstGroup.id,
      };
      defaultGroupId.value = firstGroup.id;
    }
  }
});
</script>
