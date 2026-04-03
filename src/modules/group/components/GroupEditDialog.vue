<template>
  <q-dialog v-model="dialogVisible">
    <q-card style="min-width: 520px; max-width: 680px">
      <q-card-section>
        <div class="text-h6">{{ editingGroupId ? $text('ui.edit_group') : $text('action.add') }}</div>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <GroupForm
          :group-tree="groupTree"
          :group-options="groupOptions"
          :editing-group-id="editingGroupId ?? null"
          @submit="handleSubmit"
          @cancel="dialogVisible = false"
        />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { $text } from 'src/modules/lang';
import CC from 'src/CCAccess';
import logger from 'src/utils/logger';
import { saveData } from 'src/utils/storageUtils';
import * as groupRepository from 'src/modules/group/managers/groupRepository';
import GroupForm from './GroupForm.vue';

const props = defineProps<{
  modelValue: boolean;
  editingGroupId?: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
}>();

const dialogVisible = computed({
  get: () => !!props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

const groupTree = computed(() => {
  try {
    return CC.group.list.tree.value ?? [];
  } catch {
    return [];
  }
});

const groupOptions = computed(() => {
  try {
    return (CC.group.list.all.value ?? []).map((g: any) => ({
      label: g.name,
      value: String(g.id),
    }));
  } catch {
    return [];
  }
});

async function handleSubmit(payload: any) {
  if (!payload?.name?.trim()) return;
  const name = payload.name.trim();
  const parent = payload.parent || undefined;
  const color = payload.color;
  const icon = payload.icon || undefined;

  try {
    if (props.editingGroupId) {
      const id = props.editingGroupId;
      const updates: any = {
        name,
        ...(parent !== undefined ? { parentId: parent } : {}),
        ...(color ? { color } : {}),
        ...(icon ? { icon } : {}),
        ...(typeof payload.textColor === 'string' ? { textColor: payload.textColor } : {}),
        ...(typeof payload.shareSubgroups === 'boolean' ? { shareSubgroups: payload.shareSubgroups } : {}),
        ...(typeof payload.hideTasksFromParent === 'boolean' ? { hideTasksFromParent: payload.hideTasksFromParent } : {}),
        ...(typeof payload.shortcut === 'boolean' ? { shortcut: payload.shortcut } : {}),
      };
      if (typeof CC.group.update === 'function') {
        await CC.group.update(id, updates);
      } else {
        const list = CC.group.list.all.value ?? [];
        const found = list.find((g: any) => String(g.id) === String(id));
        if (found) {
          Object.assign(found, updates);
          await saveData();
        } else {
          try { groupRepository.updateGroup(list, id, updates); } catch (e) { logger.error('updateGroup fallback failed', e); }
          try { await saveData(); } catch (e) { logger.error('saveData failed', e); }
        }
      }
    } else {
      await CC.group.add({
        name,
        parentId: parent,
        color,
        icon,
        textColor: payload.textColor,
        shareSubgroups: payload.shareSubgroups,
        hideTasksFromParent: payload.hideTasksFromParent,
        shortcut: payload.shortcut,
      });
    }
  } catch (e) {
    logger.error('GroupEditDialog: save failed', e);
  }

  dialogVisible.value = false;
}
</script>
