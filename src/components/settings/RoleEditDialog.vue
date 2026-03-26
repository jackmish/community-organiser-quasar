<template>
  <q-dialog v-model="dialogVisible">
    <q-card style="min-width: 440px; max-width: 560px">
      <q-card-section>
        <div class="text-h6">{{ editingId ? $text('role.edit_role') : $text('role.new_role') }}</div>
      </q-card-section>

      <q-card-section class="q-pt-none q-gutter-md" style="display: flex; flex-direction: column; gap: 16px">
        <!-- Role name -->
        <q-input
          v-model="name"
          :label="$text('role.name')"
          outlined
          dense
          autofocus
        />

        <!-- Range of access -->
        <div>
          <div class="text-subtitle2 q-mb-xs">{{ $text('role.access_range') }}</div>
          <q-option-group
            v-model="accessRange"
            :options="accessRangeOptions"
            type="radio"
            inline
          />
        </div>

        <!-- Privilege -->
        <div>
          <div class="text-subtitle2 q-mb-xs">{{ $text('role.privilege') }}</div>
          <q-option-group
            v-model="privilege"
            :options="privilegeOptions"
            type="radio"
            inline
          />
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="$text('action.cancel')" @click="dialogVisible = false" />
        <q-btn
          unelevated
          color="primary"
          :label="editingId ? $text('action.update') : $text('action.create')"
          :disable="!name.trim()"
          @click="onSave"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { $text } from 'src/modules/lang';
import type { AccessRange, RolePrivilege } from 'src/modules/storage/sync/RoleModel';

const props = defineProps<{
  modelValue: boolean;
  editingId?: string | null;
  initialName?: string | null;
  initialAccessRange?: AccessRange | null;
  initialPrivilege?: RolePrivilege | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'save', payload: { name: string; accessRange: AccessRange; privilege: RolePrivilege }): void;
}>();

const dialogVisible = computed({
  get: () => !!props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

const name = ref('');
const accessRange = ref<AccessRange>('single');
const privilege = ref<RolePrivilege>('preview');

// Reset form when dialog opens
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    name.value = props.initialName ?? '';
    accessRange.value = props.initialAccessRange ?? 'single';
    privilege.value = props.initialPrivilege ?? 'preview';
  },
);

const accessRangeOptions = computed(() => [
  { label: $text('role.range_max'), value: 'max' },
  { label: $text('role.range_child'), value: 'child' },
  { label: $text('role.range_single'), value: 'single' },
]);

const privilegeOptions = computed(() => [
  { label: $text('role.priv_preview'), value: 'preview' },
  { label: $text('role.priv_edit'), value: 'edit' },
  { label: $text('role.priv_full'), value: 'full' },
]);

function onSave() {
  if (!name.value.trim()) return;
  emit('save', { name: name.value.trim(), accessRange: accessRange.value, privilege: privilege.value });
  dialogVisible.value = false;
}
</script>
