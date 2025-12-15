<template>
  <q-dialog v-model="isOpen" persistent>
    <q-card style="min-width: 400px">
      <q-card-section>
        <div class="text-h6">Welcome! 👋</div>
        <div class="text-subtitle2 q-mt-sm">
          Create your first group/society/member/car name/whatever to get started. You can
          change name later.
        </div>
      </q-card-section>

      <q-card-section>
        <q-form @submit.prevent="handleSubmit">
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
          <div class="text-caption text-grey-7 q-mb-md">
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
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const isOpen = ref(props.modelValue);
const groupName = ref("");
const groupColor = ref("#1976d2");

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
</script>
