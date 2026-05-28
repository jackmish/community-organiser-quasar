<template>
  <q-dialog v-model="dialogVisible" v-bind="dialogBind">
    <q-card :class="[cardClass, 'group-management-dialog-card']" :style="cardStyle">
      <q-card-section :class="headerClass" class="q-pb-sm">
        <div
          class="row items-center group-management-dialog__header"
          :class="{ 'group-management-dialog__header--stacked': isMobile }"
        >
          <div class="text-h6">{{ $text('ui.manage_groups') }}</div>
          <div
            class="group-management-dialog__modes"
            :class="{ 'group-management-dialog__modes--full': isMobile }"
          >
            <span class="group-management-dialog__modes-label">{{ $text('ui.privilege_mode') }}</span>
            <div class="group-management-dialog__mode-btns">
              <q-btn
                dense
                :flat="privilegeMode !== 'preview'"
                :unelevated="privilegeMode === 'preview'"
                :label="$text('action.preview')"
                @click.prevent="privilegeMode = 'preview'"
                class="mode-btn"
                :class="{ active: privilegeMode === 'preview' }"
              />
              <q-btn
                dense
                :flat="privilegeMode !== 'edit'"
                :unelevated="privilegeMode === 'edit'"
                :label="$text('action.edit')"
                @click.prevent="privilegeMode = 'edit'"
                class="mode-btn"
                :class="{ active: privilegeMode === 'edit' }"
              />
              <q-btn
                dense
                :flat="privilegeMode !== 'remove'"
                :unelevated="privilegeMode === 'remove'"
                :label="$text('action.remove')"
                @click.prevent="privilegeMode = 'remove'"
                class="mode-btn"
                :class="{ active: privilegeMode === 'remove' }"
              />
            </div>
          </div>
        </div>
      </q-card-section>

      <q-card-section
        :class="[bodyClass, 'group-management-dialog__body', 'q-pt-none']"
        :style="bodyStyle"
      >
        <GroupTreeSelector :nodes="lockedGroupTree">
          <template #header="prop">
            <div class="row items-center full-width">
              <q-icon
                :name="getIconName(prop.node.icon)"
                class="q-mr-sm"
                :style="{ color: prop.node.color }"
              />
              <span class="col ellipsis">{{ prop.node.label }}</span>
              <q-btn
                v-if="privilegeMode !== 'preview'"
                flat
                dense
                round
                icon="edit"
                size="sm"
                @click.stop.prevent="openEditGroup(prop.node)"
                class="q-mr-sm"
              />

              <div class="group-management-dialog__row-actions">
                <template
                  v-if="privilegeMode === 'remove' && pendingDeleteId === prop.node.id"
                >
                  <q-btn
                    dense
                    color="negative"
                    flat
                    :label="$text('action.confirm')"
                    size="sm"
                    @click.stop.prevent="confirmDelete(prop.node.id)"
                  />
                  <q-btn
                    dense
                    flat
                    :label="$text('action.cancel')"
                    size="sm"
                    @click.stop.prevent="cancelPendingDelete"
                  />
                </template>
                <template v-else-if="privilegeMode === 'remove'">
                  <q-btn
                    flat
                    dense
                    round
                    icon="delete"
                    size="sm"
                    @click.stop.prevent="markPendingDelete(prop.node.id)"
                  />
                </template>
              </div>
            </div>
          </template>
        </GroupTreeSelector>
      </q-card-section>

      <q-card-actions class="settings-dialog-footer group-management-dialog__footer">
        <q-btn
          dense
          unelevated
          color="positive"
          icon="add"
          :label="isMobile ? undefined : $text('ui.add_group')"
          :aria-label="$text('ui.add_group')"
          @click="openCreateGroup"
        />
        <q-space />
        <q-btn flat :label="$text('action.close')" color="primary" @click="close" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { $text } from 'src/modules/lang';
import logger from 'src/utils/logger';
import CC from 'src/CCAccess';
import GroupTreeSelector from './GroupTreeSelector.vue';
import { treeNodesExpandedOnly } from 'src/modules/group/utils/treeUi';
import { useSettingsDialogLayout } from 'src/composables/useSettingsDialogLayout';

const { dialogBind, cardClass, cardStyle, headerClass, bodyClass, bodyStyle, isMobile } =
  useSettingsDialogLayout(720, 900);

const props = defineProps<{
  modelValue: boolean;
  groupOptions: any[];
  groupTree: any[];
}>();

const lockedGroupTree = computed(() => treeNodesExpandedOnly(props.groupTree || []));

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'create-group'): void;
  (e: 'edit-group', id: string): void;
  (e: 'delete-group', id: string): void;
}>();

const pendingDeleteId = ref<string | null>(null);
/** Weakest → strongest: preview, then edit, then remove. */
const privilegeMode = ref<'preview' | 'edit' | 'remove'>('preview');

const iconAlias: Record<string, string> = {
  house: 'home',
  skyscraper: 'location_city',
  factory: 'factory',
  tree: 'park',
  car: 'directions_car',
  truck: 'local_shipping',
  road: 'alt_route',
};

function getIconName(key?: string | null) {
  if (!key) return 'folder';
  return (iconAlias as any)[key] || key;
}

watch(
  () => privilegeMode.value,
  (m) => {
    if (m !== 'remove') pendingDeleteId.value = null;
  },
);

const dialogVisible = computed({
  get: () => !!props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

function openCreateGroup() {
  emit('create-group');
}

function openEditGroup(node: any) {
  const id = node?.id ?? node?.key;
  if (!id) return;
  emit('edit-group', String(id));
}

async function onDeleteGroup(id: string) {
  try {
    await CC.group.delete(id);
    emit('delete-group', id);
  } catch (e) {
    logger.error('deleteGroup failed', e);
  }
}

function markPendingDelete(id: string) {
  pendingDeleteId.value = id;
  setTimeout(() => {
    if (pendingDeleteId.value === id) pendingDeleteId.value = null;
  }, 6000);
}

function cancelPendingDelete() {
  pendingDeleteId.value = null;
}

async function confirmDelete(id: string) {
  try {
    await onDeleteGroup(id);
  } catch (e) {
    void e;
  } finally {
    pendingDeleteId.value = null;
  }
}

function close() {
  dialogVisible.value = false;
}
</script>

<style scoped lang="scss">
.group-management-dialog__header {
  gap: 12px;
  flex-wrap: wrap;
}

.group-management-dialog__header--stacked {
  flex-direction: column;
  align-items: stretch;
}

.group-management-dialog__modes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-left: auto;
}

.group-management-dialog__header--stacked .group-management-dialog__modes {
  margin-left: 0;
}

.group-management-dialog__modes--full {
  width: 100%;
}

.group-management-dialog__mode-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.group-management-dialog__row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  flex-shrink: 0;
}

.group-management-dialog__body {
  color: rgba(0, 0, 0, 0.87) !important;
}

.group-management-dialog__footer {
  flex-shrink: 0;
}

.mode-btn {
  border-radius: 4px;
  padding: 4px 8px;
  background-color: #246 !important;
}
.mode-btn.active {
  background-color: #222 !important;
  color: #fff !important;
}
</style>
