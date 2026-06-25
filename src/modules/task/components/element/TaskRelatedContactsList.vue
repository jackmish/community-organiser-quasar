<template>
  <div v-if="entries.length" class="task-related-contacts q-mt-md">
    <div class="text-caption text-weight-bold text-grey-8 q-mb-xs">
      {{ title }}
    </div>
    <q-list dense bordered separator class="task-related-contacts__list">
      <q-item v-for="entry in entries" :key="entry.key" dense>
        <q-item-section avatar>
          <q-avatar color="teal-6" text-color="white" icon="person" size="32px" />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ entry.name }}</q-item-label>
          <q-item-label v-if="entry.secondary" caption>{{ entry.secondary }}</q-item-label>
          <q-item-label v-if="entry.notes" caption class="text-grey-7">
            {{ entry.notes }}
          </q-item-label>
        </q-item-section>
      </q-item>
    </q-list>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { $text } from "src/modules/lang";
import type { Task } from "src/modules/task/models/TaskModel";
import {
  embeddedContactLabel,
  embeddedContactSecondaryLine,
  isContactNoteTask,
  isGatherContactsEnabled,
  resolveEmbeddedContacts,
} from "src/modules/task/utils/taskContacts";

const props = defineProps<{
  task: Task | null | undefined;
}>();

const title = computed(() =>
  isContactNoteTask(props.task)
    ? $text("task.contact.gathered_title")
    : $text("task.contact.related_title"),
);

const entries = computed(() => {
  const task = props.task;
  if (!task) return [];
  const hasContacts =
    isContactNoteTask(task) ||
    (isGatherContactsEnabled(task) && resolveEmbeddedContacts(task).length > 0);
  if (!hasContacts) return [];
  return resolveEmbeddedContacts(task).map((contact) => ({
    key: contact.id,
    name: embeddedContactLabel(contact),
    secondary: embeddedContactSecondaryLine(contact),
    notes: previewNotes(contact.notes),
  }));
});

function previewNotes(text?: string): string {
  const raw = String(text || "").trim();
  if (!raw) return "";
  const firstLine = raw.split("\n")[0]?.trim() || raw;
  return firstLine.length > 120 ? `${firstLine.slice(0, 117)}…` : firstLine;
}
</script>

<style scoped>
.task-related-contacts__list {
  border-radius: 8px;
  overflow: hidden;
}
</style>
