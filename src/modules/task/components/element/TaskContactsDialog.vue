<template>
  <q-dialog :model-value="open" @update:model-value="onOpenChange">
    <q-card class="task-contacts-dialog">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">{{ $text("task.contact.dialog_title") }}</div>
        <q-space />
        <q-btn flat round dense icon="close" @click="onOpenChange(false)" />
      </q-card-section>

      <q-card-section>
        <q-list v-if="localContacts.length" dense bordered separator class="q-mb-md">
          <q-item v-for="(contact, idx) in localContacts" :key="contact.id">
            <q-item-section avatar>
              <q-avatar color="teal-6" text-color="white" icon="person" size="32px" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ contact.name }}</q-item-label>
              <q-item-label v-if="embeddedContactSecondaryLine(contact)" caption>
                {{ embeddedContactSecondaryLine(contact) }}
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn
                flat
                dense
                round
                icon="edit"
                :aria-label="$text('action.edit')"
                @click="startEdit(idx)"
              />
              <q-btn
                flat
                dense
                round
                icon="delete"
                color="negative"
                :aria-label="$text('action.remove')"
                @click="removeContact(idx)"
              />
            </q-item-section>
          </q-item>
        </q-list>
        <div v-else class="text-grey-7 q-mb-md">
          {{ $text("task.contact.dialog_empty") }}
        </div>

        <div class="text-subtitle2 q-mb-sm">
          {{
            editingIndex == null
              ? $text("task.contact.dialog_add")
              : $text("task.contact.dialog_edit")
          }}
        </div>
        <q-input
          v-model="draft.name"
          :label="$text('task.contact.name_label')"
          outlined
          dense
          class="q-mb-sm"
        />
        <q-input
          v-model="draft.phone"
          :label="$text('task.contact.phone_label')"
          outlined
          dense
          class="q-mb-sm"
        />
        <q-input
          v-model="draft.email"
          :label="$text('task.contact.email_label')"
          outlined
          dense
          type="email"
          class="q-mb-sm"
        />
        <q-input
          v-model="draft.notes"
          :label="$text('task.contact.notes_label')"
          outlined
          dense
          type="textarea"
          rows="2"
        />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="$text('action.cancel')" @click="onOpenChange(false)" />
        <q-btn
          flat
          color="primary"
          :label="editingIndex == null ? $text('action.add') : $text('action.save')"
          :disable="!String(draft.name || '').trim()"
          @click="saveDraft"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { $text } from "src/modules/lang";
import type { TaskEmbeddedContact } from "src/modules/task/models/TaskModel";
import {
  embeddedContactSecondaryLine,
  newEmbeddedContactId,
  normalizeEmbeddedContacts,
} from "src/modules/task/utils/taskContacts";

const props = withDefaults(
  defineProps<{
    open?: boolean;
    contacts?: TaskEmbeddedContact[];
  }>(),
  {
    open: false,
    contacts: () => [],
  },
);

const emit = defineEmits<{
  "update:open": [value: boolean];
  "update:contacts": [value: TaskEmbeddedContact[]];
}>();

const localContacts = ref<TaskEmbeddedContact[]>([]);
const editingIndex = ref<number | null>(null);
const draft = ref({
  name: "",
  phone: "",
  email: "",
  notes: "",
});

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    localContacts.value = normalizeEmbeddedContacts(props.contacts);
    resetDraft();
  },
);

watch(
  () => props.contacts,
  (value) => {
    if (!props.open) return;
    localContacts.value = normalizeEmbeddedContacts(value);
  },
  { deep: true },
);

function resetDraft(): void {
  editingIndex.value = null;
  draft.value = { name: "", phone: "", email: "", notes: "" };
}

function startEdit(index: number): void {
  const contact = localContacts.value[index];
  if (!contact) return;
  editingIndex.value = index;
  draft.value = {
    name: contact.name,
    phone: contact.phone || "",
    email: contact.email || "",
    notes: contact.notes || "",
  };
}

function removeContact(index: number): void {
  localContacts.value = localContacts.value.filter((_, i) => i !== index);
  if (editingIndex.value === index) resetDraft();
  emit("update:contacts", [...localContacts.value]);
}

function saveDraft(): void {
  const name = String(draft.value.name || "").trim();
  if (!name) return;
  const next: TaskEmbeddedContact = {
    id:
      editingIndex.value != null
        ? localContacts.value[editingIndex.value]?.id || newEmbeddedContactId()
        : newEmbeddedContactId(),
    name,
    phone: String(draft.value.phone || "").trim(),
    email: String(draft.value.email || "").trim(),
    notes: String(draft.value.notes || "").trim(),
  };
  const rows = [...localContacts.value];
  if (editingIndex.value != null) rows[editingIndex.value] = next;
  else rows.push(next);
  localContacts.value = rows;
  emit("update:contacts", [...rows]);
  resetDraft();
}

function onOpenChange(value: boolean): void {
  emit("update:open", value);
  if (!value) resetDraft();
}
</script>

<style scoped>
.task-contacts-dialog {
  width: min(520px, 96vw);
}
</style>
