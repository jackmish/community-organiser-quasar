<template>
  <div
    class="co21-group-tree-panel"
    :class="[
      selectionStyle === 'pill' ? 'co21-group-tree-panel--pill' : null,
      panelClass,
    ]"
    :style="panelStyle"
  >
    <q-tree
      class="q-tree-expanded-only co21-group-tree-panel__tree"
      :class="treeClass"
      :nodes="resolvedNodes"
      node-key="id"
      default-expand-all
      no-connectors
      v-model:expanded="treeExpanded"
      :selected="quasarSelected"
      :selected-color="selectedColor"
      @update:expanded="onTreeExpandedUpdate"
      @update:selected="onTreeSelectedUpdate"
    >
      <template #default-header="scope">
        <slot
          name="header"
          v-bind="scope"
          :selected="isNodeSelected(scope.key)"
        >
          <div
            v-if="selectionStyle === 'pill'"
            class="co21-group-tree-node row items-center full-width q-px-sm q-py-xs rounded-borders"
            :class="{
              'co21-group-tree-node--selected': isNodeSelected(scope.key),
            }"
          >
            <q-icon
              :name="scope.node.icon || 'folder'"
              class="q-mr-sm"
              :style="iconStyle(scope.node)"
            />
            <span class="co21-group-tree-node__label">{{ scope.node.label }}</span>
          </div>
          <div v-else class="row items-center full-width">
            <q-icon
              :name="scope.node.icon || 'folder'"
              class="q-mr-sm"
              :style="iconStyle(scope.node)"
            />
            <span>{{ scope.node.label }}</span>
          </div>
        </slot>
      </template>
    </q-tree>
  </div>
</template>

<script setup lang="ts">
import { computed, type StyleValue } from 'vue';
import { useTreeAlwaysExpanded } from 'src/composables/useTreeAlwaysExpanded';
import {
  groupsToTreeNodes,
  treeNodeKeyString,
  type GroupTreeNode,
  type TreeNodeLike,
} from 'src/modules/group/utils/treeUi';

const props = withDefaults(
  defineProps<{
    groups?: unknown[] | undefined;
    nodes?: TreeNodeLike[] | undefined;
    /** Single id, Quasar array form, or null */
    selected?: string | string[] | null;
    stickySelection?: boolean;
    selectionStyle?: 'default' | 'pill';
    selectedColor?: string;
    panelClass?: string;
    treeClass?: string;
    maxHeight?: string;
    minWidth?: string;
  }>(),
  {
    selectionStyle: 'default',
    selectedColor: 'primary',
    stickySelection: false,
    maxHeight: '48vh',
    minWidth: '260px',
  },
);

const emit = defineEmits<{
  (e: 'update:selected', value: string | string[] | null): void;
  (e: 'select', payload: { id: string; node: GroupTreeNode | null }): void;
}>();

const resolvedNodes = computed(() => {
  if (props.nodes?.length) {
    return props.nodes as GroupTreeNode[];
  }
  try {
    return groupsToTreeNodes(props.groups || []);
  } catch {
    return [];
  }
});

const { expanded: treeExpanded, onExpandedUpdate: onTreeExpandedUpdate } =
  useTreeAlwaysExpanded(resolvedNodes);

const panelStyle = computed((): StyleValue => {
  const style: Record<string, string> = {};
  if (props.maxHeight) style.maxHeight = props.maxHeight;
  if (props.minWidth) style.minWidth = props.minWidth;
  return style;
});

function normalizeSelectedInput(
  value: string | string[] | null | undefined,
): string | string[] | null {
  if (value == null || value === '') return null;
  if (Array.isArray(value)) {
    const ids = value.map((v) => treeNodeKeyString(v)).filter(Boolean);
    return ids.length ? ids : null;
  }
  const id = treeNodeKeyString(value);
  return id || null;
}

const quasarSelected = computed(() => {
  const sel = normalizeSelectedInput(props.selected);
  if (sel == null) return null;
  return sel;
});

function isNodeSelected(key: unknown): boolean {
  const id = treeNodeKeyString(key);
  if (!id) return false;
  const sel = normalizeSelectedInput(props.selected);
  if (sel == null) return false;
  if (Array.isArray(sel)) return sel.includes(id);
  return sel === id;
}

function iconStyle(node: { color?: string | null }): Record<string, string> | undefined {
  return node.color ? { color: node.color } : undefined;
}

function findNodeById(nodes: GroupTreeNode[], id: string): GroupTreeNode | null {
  for (const n of nodes) {
    if (treeNodeKeyString(n.id) === id) return n;
    if (n.children?.length) {
      const found = findNodeById(n.children as GroupTreeNode[], id);
      if (found) return found;
    }
  }
  return null;
}

function onTreeSelectedUpdate(val: string | string[] | null): void {
  if (
    props.stickySelection &&
    (val == null || val === '' || (Array.isArray(val) && !val.length))
  ) {
    return;
  }

  const normalized = normalizeSelectedInput(val);
  emit('update:selected', normalized);

  const id = Array.isArray(normalized)
    ? normalized[0]
    : normalized != null
      ? normalized
      : '';
  if (!id) return;
  emit('select', { id, node: findNodeById(resolvedNodes.value, id) });
}
</script>
