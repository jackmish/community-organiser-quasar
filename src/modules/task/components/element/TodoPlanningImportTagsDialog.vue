<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { $text } from 'src/modules/lang';
import {
  listPlanningTagImportCandidates,
  type PlanningTagImportCandidate,
  type PlanningTagImportTask,
} from 'src/modules/task/dayPlanning/dayPlanningUtils';
import { todoCalendarSchedule } from 'src/composables/useTodoCalendarSchedule';

const props = defineProps<{
  modelValue: boolean;
  tasks: readonly PlanningTagImportTask[];
  sourceTaskId?: string | null | undefined;
  sourceTypeId?: string | null | undefined;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'import', tags: Array<{ id: string; label: string }>): void;
}>();

const search = ref('');
const selectedTaskId = ref<string | null>(null);
const newTagInput = ref('');
const draftLabels = ref<Record<string, string>>({});

const currentTags = computed(() => todoCalendarSchedule.planningTags.value);

const candidates = computed((): PlanningTagImportCandidate[] =>
  listPlanningTagImportCandidates(props.tasks, {
    sourceTaskId: props.sourceTaskId,
    typeId: props.sourceTypeId,
    search: search.value,
  }),
);

const selectedCandidate = computed(() =>
  candidates.value.find((c) => c.id === selectedTaskId.value) ?? null,
);

const previewTags = computed(() => selectedCandidate.value?.tags ?? []);

const dialogOpen = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

function syncDraftLabels() {
  draftLabels.value = Object.fromEntries(currentTags.value.map((t) => [t.id, t.label]));
}

watch(dialogOpen, (open) => {
  if (!open) {
    search.value = '';
    selectedTaskId.value = null;
    newTagInput.value = '';
    draftLabels.value = {};
    return;
  }
  syncDraftLabels();
  if (!selectedTaskId.value && candidates.value.length === 1) {
    selectedTaskId.value = candidates.value[0]!.id;
  }
});

watch(currentTags, () => {
  if (!dialogOpen.value) return;
  syncDraftLabels();
});

watch(candidates, (list) => {
  if (!dialogOpen.value) return;
  if (selectedTaskId.value && list.some((c) => c.id === selectedTaskId.value)) return;
  selectedTaskId.value = list[0]?.id ?? null;
});

function closeDialog() {
  dialogOpen.value = false;
}

function onAddTag() {
  const added = todoCalendarSchedule.addPlanningTag(newTagInput.value);
  if (added) {
    draftLabels.value = { ...draftLabels.value, [added.id]: added.label };
    newTagInput.value = '';
  }
}

function commitTagLabel(tagId: string) {
  const draft = String(draftLabels.value[tagId] ?? '').trim();
  const existing = currentTags.value.find((t) => t.id === tagId);
  if (!existing || !draft || draft === existing.label) return;
  todoCalendarSchedule.updatePlanningTag(tagId, draft);
}

function onRemoveTag(tagId: string) {
  todoCalendarSchedule.removePlanningTag(tagId);
  const next = { ...draftLabels.value };
  delete next[tagId];
  draftLabels.value = next;
}

function onConfirmImport() {
  if (!previewTags.value.length) return;
  emit('import', previewTags.value.map((t) => ({ id: t.id, label: t.label })));
  syncDraftLabels();
}
</script>

<template>
  <q-dialog v-model="dialogOpen" class="todo-planning-tags-dialog">
    <q-card style="min-width: min(520px, 96vw); max-width: 96vw">
      <q-card-section class="row items-center q-pb-sm">
        <div class="text-h6">{{ $text('task.todo.planning.import_tags_title') }}</div>
        <q-space />
        <q-btn flat round dense icon="close" :aria-label="$text('action.cancel')" @click="closeDialog" />
      </q-card-section>

      <q-card-section class="q-pt-none q-gutter-md">
        <div class="todo-planning-tags-dialog__section">
          <div class="text-subtitle2 text-weight-bold q-mb-sm">
            {{ $text('task.todo.planning.tags_manage_section') }}
          </div>

          <div v-if="!currentTags.length" class="text-body2 text-grey-7 q-mb-sm">
            {{ $text('task.todo.planning.tags_manage_empty') }}
          </div>

          <div v-else class="todo-planning-tags-dialog__edit-list q-mb-sm">
            <div
              v-for="tag in currentTags"
              :key="tag.id"
              class="todo-planning-tags-dialog__edit-row"
            >
              <q-input
                v-model="draftLabels[tag.id]"
                dense
                outlined
                :aria-label="$text('task.todo.planning.tags_rename')"
                @blur="commitTagLabel(tag.id)"
                @keydown.enter.prevent="commitTagLabel(tag.id)"
              />
              <q-btn
                flat
                round
                dense
                icon="delete"
                color="negative"
                :aria-label="$text('action.delete')"
                @click="onRemoveTag(tag.id)"
              />
            </div>
          </div>

          <div class="todo-planning-tags-dialog__add-row">
            <q-input
              v-model="newTagInput"
              dense
              outlined
              :placeholder="$text('task.todo.planning.tag_placeholder')"
              @keydown.enter.prevent="onAddTag"
            />
            <q-btn
              unelevated
              color="primary"
              icon="add"
              :label="$text('task.todo.planning.add_tag')"
              @click="onAddTag"
            />
          </div>
        </div>

        <q-separator />

        <div class="todo-planning-tags-dialog__section">
          <div class="text-subtitle2 text-weight-bold q-mb-sm">
            {{ $text('task.todo.planning.tags_import_section') }}
          </div>

          <q-input
            v-model="search"
            dense
            outlined
            clearable
            :placeholder="$text('task.todo.planning.import_tags_search_placeholder')"
          >
            <template #prepend>
              <q-icon name="search" />
            </template>
          </q-input>

          <div v-if="!candidates.length" class="text-body2 text-grey-7">
            {{ $text('task.todo.planning.import_tags_empty') }}
          </div>

          <q-list v-else bordered separator class="todo-planning-tags-dialog__list">
            <q-item
              v-for="candidate in candidates"
              :key="candidate.id"
              clickable
              :active="selectedTaskId === candidate.id"
              active-class="bg-blue-1"
              @click="selectedTaskId = candidate.id"
            >
              <q-item-section>
                <q-item-label>{{ candidate.name }}</q-item-label>
                <q-item-label caption>
                  {{ candidate.tags.length }}
                  {{ $text('task.todo.planning.tags_label').toLowerCase() }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>

          <div v-if="previewTags.length" class="todo-planning-tags-dialog__preview">
            <div class="text-caption text-weight-bold text-grey-7 q-mb-xs">
              {{ $text('task.todo.planning.import_tags_preview') }}
            </div>
            <div class="todo-planning-tags-dialog__preview-tags">
              <q-chip
                v-for="tag in previewTags"
                :key="`${selectedTaskId}-${tag.id}`"
                dense
                color="primary"
                text-color="white"
              >
                {{ tag.label }}
              </q-chip>
            </div>
          </div>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="$text('action.close')" @click="closeDialog" />
        <q-btn
          unelevated
          color="primary"
          icon="file_download"
          :disable="!previewTags.length"
          :label="$text('task.todo.planning.import_tags_confirm')"
          @click="onConfirmImport"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">
.todo-planning-tags-dialog__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.todo-planning-tags-dialog__edit-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 28vh;
  overflow: auto;
}

.todo-planning-tags-dialog__edit-row {
  display: flex;
  align-items: center;
  gap: 4px;

  .q-field {
    flex: 1 1 auto;
  }
}

.todo-planning-tags-dialog__add-row {
  display: flex;
  align-items: center;
  gap: 8px;

  .q-field {
    flex: 1 1 auto;
  }
}

.todo-planning-tags-dialog__list {
  max-height: 28vh;
  overflow: auto;
}

.todo-planning-tags-dialog__preview-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
