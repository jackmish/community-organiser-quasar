<template>
  <div class="group-tree-selector">
    <q-tree
      class="q-tree-expanded-only"
      :nodes="treeNodes"
      node-key="id"
      default-expand-all
      no-connectors
      v-model:expanded="treeExpanded"
      @update:expanded="onTreeExpandedUpdate"
      @update:selected="onSelect"
    >
      <template #default-header="{ node }">
        <div class="row items-center">
          <q-icon :name="node.icon || 'folder'" :style="{ color: node.color }" class="q-mr-sm" />
          <span>{{ node.label }}</span>
          <q-space />
        </div>
      </template>
    </q-tree>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useTreeAlwaysExpanded } from 'src/composables/useTreeAlwaysExpanded';
import { treeNodesExpandedOnly } from 'src/modules/group/utils/treeUi';

const props = defineProps<{
  groups?: any[] | undefined;
}>();

const emit = defineEmits<{
  (e: 'select', group: any): void;
}>();

function convertNode(n: any) {
  return {
    id: String(n.id),
    label: n.name || n.label || String(n.id),
    icon: n.icon || 'folder',
    color: n.color || null,
    children: (n.children || []).map(convertNode),
  };
}

const treeNodes = computed(() => {
  try {
    return treeNodesExpandedOnly((props.groups || []).map(convertNode));
  } catch (e) {
    return [];
  }
});

const { expanded: treeExpanded, onExpandedUpdate: onTreeExpandedUpdate } =
  useTreeAlwaysExpanded(treeNodes);

function onSelect(val: any) {
  const key = Array.isArray(val) ? val[0] : val;
  if (!key) return;
  const found = (props.groups || []).find((g: any) => String(g.id) === String(key));
  emit('select', found || { id: key });
}
</script>

<style scoped>
.group-tree-selector {
  min-width: 260px;
  max-height: 48vh;
  overflow: auto;
}
</style>
