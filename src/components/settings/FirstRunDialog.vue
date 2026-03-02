<template>
  <q-dialog v-model="isOpen" persistent>
    <q-card style="min-width: 400px">
      <q-card-section>
        <div class="text-h6">Welcome! 👋</div>
        <div class="text-subtitle2 q-mt-sm">
          To use this app, you need to create a group first or import app data from a
          file. Example group names: "Family","Name of
          community/job/person/school/hobby/project/car/house", "Notes"
        </div>
      </q-card-section>

      <q-card-section>
        <q-form @submit.prevent="handleSubmit">
                  <q-btn
                    color="secondary"
                    label="Import Data"
                    icon="upload"
                    class="full-width q-mb-md"
                    @click.prevent="triggerImport"
                  />
                  <input
                    ref="fileInput"
                    type="file"
                    accept=".json,application/json,.zip,application/zip"
                    style="display: none"
                    @change="handleFileChange"
                  />

          <hr />
          <br />
          <strong>Or create a new group:</strong><br /><br />

          <q-input
            v-model="groupName"
            label="Group Name (e.g. 'Community, Project, Person, Car, Place')"
            outlined
            autofocus
            :rules="[(val) => !!val || 'Group name is required']"
            class="q-mb-md"
          />
          <q-input v-model="groupColor" label="Color" outlined class="q-mb-md">
            <template #append>
              <input
                v-model="groupColor"
                type="color"
                style="width: 40px; height: 30px; border: none; cursor: pointer"
              />
            </template>
          </q-input>
          <div class="text-caption q-mb-md">
            All your tasks will be organized in this group by default. You can create more
            groups later!
          </div>
          <q-btn
            type="submit"
            color="primary"
            label="Create Group & Start"
            :disable="!groupName"
            class="full-width"
          />
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";

interface Props {
  modelValue: boolean;
}

interface Emits {
  (e: "update:modelValue", value: boolean): void;
  (e: "create", data: { name: string; color: string }): void;
  (e: "import", file: File): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const isOpen = ref(props.modelValue);
const groupName = ref("");
const groupColor = ref("#1976d2");
const fileInput = ref<HTMLInputElement | null>(null);

watch(
  () => props.modelValue,
  (newVal) => {
    isOpen.value = newVal;
  }
);

watch(isOpen, (newVal) => {
  emit("update:modelValue", newVal);
});

const handleSubmit = () => {
  if (!groupName.value.trim()) return;

  emit("create", {
    name: groupName.value,
    color: groupColor.value,
  });

  // Reset form
  groupName.value = "";
  groupColor.value = "#1976d2";
};

const triggerImport = () => {
  fileInput.value?.click();
};

const handleFileChange = (e: Event) => {
  const input = e.target as HTMLInputElement | null;
  const file = input?.files?.[0] ?? null;
  if (!file) return;
  // Emit the raw File so storage layer can handle .zip or .json
  emit('import', file);
  // reset input so same file can be re-selected later
  if (fileInput.value) fileInput.value.value = '';
};
</script>
