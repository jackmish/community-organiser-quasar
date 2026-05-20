/** Quasar QTree node with optional children. */
export type TreeNodeLike = {
  id?: string | number;
  children?: TreeNodeLike[];
  expandable?: boolean;
  [key: string]: unknown;
};

export function treeNodeKeyString(value: unknown): string {
  if (typeof value === 'string') return value.length ? value : '';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

export function collectTreeNodeKeys(
  nodes: TreeNodeLike[],
  nodeKey: keyof TreeNodeLike = 'id',
): string[] {
  const out: string[] = [];
  for (const n of nodes || []) {
    const id = treeNodeKeyString(n[nodeKey]);
    if (id) out.push(id);
    if (Array.isArray(n.children) && n.children.length) {
      out.push(...collectTreeNodeKeys(n.children, nodeKey));
    }
  }
  return out;
}

/** Pass-through for tree nodes (expansion locked via CSS + useTreeAlwaysExpanded). */
export function treeNodesExpandedOnly<T extends TreeNodeLike>(nodes: T[]): T[] {
  return nodes || [];
}
