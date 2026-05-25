<template>
  <div class="co21-group-picker">
    <q-list v-if="showAllGroups" padding>
      <q-item clickable v-ripple @click="onSelectAll">
        <q-item-section avatar>
          <q-icon name="folder_open" />
        </q-item-section>
        <q-item-section>{{ $text('ui.all_groups') }}</q-item-section>
      </q-item>
    </q-list>

    <q-separator v-if="showAllGroups" />

    <GroupTreeSelector
      class="q-mt-sm"
      :nodes="treeNodes"
      :selected="selectedKeyArray"
      :max-height="maxHeight"
      @update:selected="onTreeSelect"
    >
      <template #header="prop">
        <div class="row items-center full-width">
          <q-icon
            :name="prop.node.icon || 'folder'"
            class="q-mr-sm"
            :style="{ color: prop.node.color }"
          />
          <span>{{ prop.node.label }}</span>
        </div>
      </template>
    </GroupTreeSelector>

    <q-separator />

    <q-list padding>
      <q-item clickable v-ripple @click="openManage">
        <q-item-section avatar>
          <q-icon name="folder_special" />
        </q-item-section>
        <q-item-section>{{ $text('ui.manage_groups') }}</q-item-section>
      </q-item>
      <q-item clickable v-ripple @click="$emit('create-group')" class="text-positive">
        <q-item-section avatar>
          <q-icon name="add_circle" color="positive" />
        </q-item-section>
        <q-item-section class="text-weight-medium">{{ $text('ui.add_group') }} +</q-item-section>
      </q-item>
    </q-list>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { $text } from 'src/modules/lang';
import CC from 'src/CCAccess';
import GroupTreeSelector from './GroupTreeSelector.vue';
import { groupsToTreeNodes } from 'src/modules/group/utils/treeUi';

const props = withDefaults(
  defineProps<{
    selected?: string | null;
    showAllGroups?: boolean;
    maxHeight?: string;
  }>(),
  {
    selected: null,
    showAllGroups: true,
    maxHeight: '48vh',
  },
);

const emit = defineEmits<{
  (e: 'update:selected', value: string | null): void;
  (e: 'select-all'): void;
  (e: 'create-group'): void;
  (e: 'manage'): void;
}>();

const treeNodes = computed(() => {
  try {
    return groupsToTreeNodes(CC.group.list.tree.value || []);
  } catch {
    return [];
  }
});

const selectedKeyArray = computed(() =>
  props.selected ? [String(props.selected)] : [],
);

function onSelectAll() {
  emit('select-all');
  emit('update:selected', null);
}

function onTreeSelect(val: string | string[] | null) {
  const key = Array.isArray(val) ? val[0] : val;
  if (!key) return;
  emit('update:selected', String(key));
}

function openManage() {
  emit('manage');
  window.dispatchEvent(new Event('group:manage-request'));
}
</script>
