import { ref, watch, type Ref } from 'vue';
import {
  collectTreeNodeKeys,
  type TreeNodeLike,
} from 'src/modules/group/utils/treeUi';

/** Keep every QTree branch expanded; ignores collapse attempts. */
export function useTreeAlwaysExpanded(
  nodes: Ref<TreeNodeLike[] | undefined | null>,
  nodeKey: keyof TreeNodeLike = 'id',
) {
  const expanded = ref<string[]>([]);

  function syncExpanded(): void {
    expanded.value = collectTreeNodeKeys(nodes.value ?? [], nodeKey);
  }

  watch(nodes, syncExpanded, { immediate: true, deep: true });

  function onExpandedUpdate(): void {
    syncExpanded();
  }

  return { expanded, onExpandedUpdate };
}
