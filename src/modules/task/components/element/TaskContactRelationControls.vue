<template>
  <div class="task-relation-toolbar row items-center no-wrap">
    <!-- Entity-relationship: enable resource/relation types (contacts, planning, …) -->
    <q-btn
      v-if="showRelationButton"
      unelevated
      :class="[
        'form-toolbar-btn',
        'form-toolbar-btn--relation',
        { 'form-toolbar-btn--compact': compact },
      ]"
      icon="schema"
      :aria-label="$text('task.relation.assign')"
    >
      <q-menu
        anchor="top left"
        self="bottom left"
        :max-height="'320px'"
        class="task-relation-menu"
      >
        <q-list dense separator style="min-width: 220px; max-width: 320px">
          <q-item
            v-for="opt in relationTypeOptions"
            :key="opt.id"
            dense
            :clickable="opt.active"
            @click="opt.active ? toggleRelationType(opt.id) : undefined"
          >
            <q-item-section side>
              <q-checkbox
                dense
                :disable="!opt.active"
                :model-value="isRelationTypeEnabled(opt.id)"
                @update:model-value="
                  (val) => (opt.active ? setRelationType(opt.id, !!val) : undefined)
                "
                @click.stop
              />
            </q-item-section>
            <q-item-section>
              <q-item-label :class="{ 'text-grey-5': !opt.active }">
                {{ $text(opt.labelKey) }}
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-menu>
    </q-btn>

    <!-- Contacts: manage people on this task (after relation enabled, or contact note task) -->
    <q-btn
      v-if="showContactsManageButton"
      unelevated
      :class="[
        'form-toolbar-btn',
        'form-toolbar-btn--contact-dialog',
        { 'form-toolbar-btn--compact': compact },
      ]"
      icon="contacts"
      :aria-label="$text('task.contact.manage_dialog')"
      @click="contactsDialogOpen = true"
    />

    <q-btn
      v-if="showCountBadge"
      unelevated
      :class="[
        'form-toolbar-btn',
        'form-toolbar-btn--contact-count',
        { 'form-toolbar-btn--compact': compact },
        { 'form-toolbar-btn--clickable': showContactsManageButton },
      ]"
      :aria-label="countAriaLabel"
      @click="onCountBadgeClick"
    >
      <q-icon name="contacts" size="22px" />
      <span class="task-contact-count-badge">{{ contactCount }}</span>
    </q-btn>

    <TaskContactsDialog
      v-model:open="contactsDialogOpen"
      :contacts="embeddedContacts"
      @update:contacts="emit('update:embeddedContacts', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { $text } from "src/modules/lang";
import type { TaskEmbeddedContact } from "src/modules/task/models/TaskModel";
import TaskContactsDialog from "./TaskContactsDialog.vue";
import { normalizeEmbeddedContacts } from "src/modules/task/utils/taskContacts";

type RelationTypeId = "contacts" | "planning" | "accounting" | "diagrams";

const props = withDefaults(
  defineProps<{
    isContactTask?: boolean;
    gatherContactsEnabled?: boolean;
    embeddedContacts?: TaskEmbeddedContact[];
    editable?: boolean;
    compact?: boolean;
  }>(),
  {
    isContactTask: false,
    gatherContactsEnabled: false,
    embeddedContacts: () => [],
    editable: true,
    compact: false,
  },
);

const emit = defineEmits<{
  "update:gatherContactsEnabled": [value: boolean];
  "update:embeddedContacts": [value: TaskEmbeddedContact[]];
}>();

const contactsDialogOpen = ref(false);

const embeddedList = computed(() => normalizeEmbeddedContacts(props.embeddedContacts));
const contactCount = computed(() => embeddedList.value.length);

const relationTypeOptions = computed(() => [
  {
    id: "contacts" as RelationTypeId,
    labelKey: "task.relation.type.contacts",
    active: true,
  },
  {
    id: "planning" as RelationTypeId,
    labelKey: "task.relation.type.planning",
    active: false,
  },
  {
    id: "accounting" as RelationTypeId,
    labelKey: "task.relation.type.accounting",
    active: false,
  },
  {
    id: "diagrams" as RelationTypeId,
    labelKey: "task.relation.type.diagrams",
    active: false,
  },
]);

/** ER picker — all task types in edit mode except pure contact-note (contacts managed directly). */
const showRelationButton = computed(
  () => props.editable && !props.isContactTask,
);

/** Contacts dialog — contact note tasks, or after Contacts relation is checked. */
const showContactsManageButton = computed(() => {
  if (!props.editable) return false;
  if (props.isContactTask) return true;
  return props.gatherContactsEnabled;
});

const showCountBadge = computed(() => {
  if (contactCount.value <= 0) return false;
  if (props.isContactTask) return true;
  return props.gatherContactsEnabled;
});

const countAriaLabel = computed(() =>
  $text("task.contact.count_label").replace("{count}", String(contactCount.value)),
);

function isRelationTypeEnabled(id: RelationTypeId): boolean {
  if (id === "contacts") return props.gatherContactsEnabled;
  return false;
}

function setRelationType(id: RelationTypeId, enabled: boolean): void {
  if (id !== "contacts") return;
  emit("update:gatherContactsEnabled", enabled);
  if (!enabled) emit("update:embeddedContacts", []);
}

function toggleRelationType(id: RelationTypeId): void {
  if (id !== "contacts") return;
  setRelationType(id, !props.gatherContactsEnabled);
}

function onCountBadgeClick(): void {
  if (showContactsManageButton.value) contactsDialogOpen.value = true;
}
</script>

<style scoped>
.task-relation-toolbar {
  gap: 8px;
}

.form-toolbar-btn {
  width: 48px;
  height: 48px;
  min-width: 48px !important;
  min-height: 48px !important;
  padding: 0 !important;
  border-radius: 8px;
  position: relative;
}

.form-toolbar-btn :deep(.q-icon) {
  font-size: 24px;
}

.form-toolbar-btn--relation {
  background: #7e57c2 !important;
  color: #fff !important;
}

.form-toolbar-btn--contact-dialog,
.form-toolbar-btn--contact-count {
  background: #26a69a !important;
  color: #fff !important;
}

.form-toolbar-btn--clickable {
  cursor: pointer;
}

.form-toolbar-btn--compact {
  width: 36px;
  height: 36px;
  min-width: 36px !important;
  min-height: 36px !important;
}

.form-toolbar-btn--compact :deep(.q-icon) {
  font-size: 20px;
}

.form-toolbar-btn--compact .task-contact-count-badge {
  right: 2px;
  bottom: 2px;
  min-width: 14px;
  height: 14px;
  font-size: 10px;
  line-height: 14px;
}

.task-contact-count-badge {
  position: absolute;
  right: 4px;
  bottom: 4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.28);
  font-size: 11px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
}
</style>
