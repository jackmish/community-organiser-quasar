<template>
  <q-dialog v-model="dialogVisible" class="group-edit-dialog" v-bind="dialogBind">
    <q-card :class="[cardClass, 'group-edit-dialog__card']" :style="cardStyle">
      <q-card-section :class="headerClass">
        <div class="text-h6">{{ editingGroupId ? $text('ui.edit_group') : $text('action.add') }}</div>
      </q-card-section>

      <q-card-section class="q-pt-none group-edit-dialog__body" :class="bodyClass" :style="bodyStyle">
        <GroupForm
          :group-tree="groupTree"
          :group-options="groupOptions"
          :editing-group-id="editingGroupId ?? null"
          :initial-parent-id="initialParentId ?? null"
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
import {
  resolveLocalGroupName,
  setLocalGroupName,
} from 'src/modules/group/utils/groupLocalNames';
import GroupForm from './GroupForm.vue';
import { useSettingsDialogLayout } from 'src/composables/useSettingsDialogLayout';

const { dialogBind, cardClass, cardStyle, headerClass, bodyClass, bodyStyle } =
  useSettingsDialogLayout(520, 680);

const props = defineProps<{
  modelValue: boolean;
  editingGroupId?: string | null;
  initialParentId?: string | null;
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
      label: resolveLocalGroupName(g),
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
        ...(typeof payload.backgroundColorize === 'boolean'
          ? { backgroundColorize: payload.backgroundColorize }
          : {}),
        ...(typeof payload.calendarColorize === 'boolean'
          ? { calendarColorize: payload.calendarColorize }
          : {}),
        ...(payload.backgroundImage
          ? { backgroundImage: payload.backgroundImage }
          : { backgroundImage: undefined }),
      };
      if (typeof CC.group.update === 'function') {
        await CC.group.update(id, updates);
      } else {
        const list = CC.group.list.all.value ?? [];
        try {
          groupRepository.updateGroup(list, id, updates);
          await saveData();
        } catch (e) {
          logger.error('updateGroup fallback failed', e);
        }
      }
      setLocalGroupName(id, payload.localName ?? '');
    } else {
      const created: any = await CC.group.add({
        name,
        parentId: parent,
        color,
        icon,
        textColor: payload.textColor,
        shareSubgroups: payload.shareSubgroups,
        hideTasksFromParent: payload.hideTasksFromParent,
        shortcut: payload.shortcut,
        ...(payload.backgroundImage ? { backgroundImage: payload.backgroundImage } : {}),
        ...(typeof payload.backgroundColorize === 'boolean'
          ? { backgroundColorize: payload.backgroundColorize }
          : {}),
        ...(typeof payload.calendarColorize === 'boolean'
          ? { calendarColorize: payload.calendarColorize }
          : {}),
      });
      const createdId = String(created?.id || '').trim();
      if (createdId) setLocalGroupName(createdId, payload.localName ?? '');
    }
  } catch (e) {
    logger.error('GroupEditDialog: save failed', e);
  }

  dialogVisible.value = false;
}
</script>

<style scoped>
.group-edit-dialog__card,
:deep(.group-edit-dialog__card .q-card-section) {
  overflow: visible;
}
</style>
