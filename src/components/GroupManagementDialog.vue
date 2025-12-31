<template>
  <q-dialog v-model="dialogVisible">
    <q-card style="min-width: 500px">
      <q-card-section>
        <div class="text-h6">Manage Groups</div>

        <q-card-section class="q-pt-sm">
          <q-form @submit.prevent="onAddGroup" class="q-mb-md">
            <div class="row q-gutter-sm items-end">
              <q-input v-model="localName" label="Group Name" outlined dense class="col" />

              <q-select
                v-model="localParent"
                :options="groupOptions"
                label="Parent Group (optional)"
                outlined
                dense
                clearable
                style="min-width: 180px"
              />

              <q-input v-model="localColor" label="Color" outlined dense style="max-width: 120px">
                <template #append>
                  <input
                    v-model="localColor"
                    type="color"
                    style="width: 40px; height: 30px; border: none; cursor: pointer"
                  />
                </template>
              </q-input>

              <q-btn type="submit" color="primary" icon="add" dense />
            </div>
          </q-form>
        </q-card-section>

        <q-tree :nodes="groupTree" node-key="id" default-expand-all>
          <template #default-header="prop">
            <div class="row items-center full-width">
              <q-icon :name="prop.node.icon || 'folder'" :color="prop.node.color" class="q-mr-sm" />
              <span>{{ prop.node.label }}</span>
              <q-space />
              <q-btn
                flat
                dense
                round
                icon="delete"
                size="sm"
                @click.stop="onDeleteGroup(prop.node.id)"
              />
            </div>
          </template>
        </q-tree>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Close" color="primary" @click="close" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';

import { useDayOrganiser } from '../modules/day-organiser';

const props = defineProps<{
  modelValue: boolean;
  groupOptions: any[];
  groupTree: any[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'add-group', payload: { name: string; parent?: string; color?: string }): void;
  (e: 'delete-group', id: string): void;
}>();

const localName = ref('');
const localParent = ref<string | null>(null);
const localColor = ref('#1976d2');

const dialogVisible = computed({
  get: () => !!props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      localName.value = '';
      localParent.value = null;
      localColor.value = '#1976d2';
    }
  },
);

async function onAddGroup() {
  if (!localName.value.trim()) return;
  const payload: { name: string; parent?: string; color?: string } = {
    name: localName.value.trim(),
    color: localColor.value,
  };
  if (localParent.value) payload.parent = localParent.value;

  try {
    const { addGroup } = useDayOrganiser();
    await addGroup(payload.name, payload.parent, payload.color as any);
  } catch (e) {
    console.error('addGroup failed', e);
  }

  // reset and close
  localName.value = '';
  localParent.value = null;
  localColor.value = '#1976d2';
  dialogVisible.value = false;
}

async function onDeleteGroup(id: string) {
  try {
    const { deleteGroup } = useDayOrganiser();
    await deleteGroup(id);
  } catch (e) {
    console.error('deleteGroup failed', e);
  }
}

function close() {
  dialogVisible.value = false;
}
</script>

<style scoped></style>
