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

export type GroupTreeNode = TreeNodeLike & {
  id: string;
  label: string;
  icon?: string;
  color?: string | null;
  children?: GroupTreeNode[];
};

/** Normalize group/CC tree records into Quasar QTree nodes. */
export function groupRecordToTreeNode(n: Record<string, unknown>): GroupTreeNode {
  const id = treeNodeKeyString(n.id);
  const name = typeof n.name === 'string' ? n.name : '';
  const labelField = typeof n.label === 'string' ? n.label : '';
  return {
    id,
    label: name || labelField || id,
    icon: typeof n.icon === 'string' ? n.icon : 'folder',
    color: (n.color as string | null | undefined) ?? null,
    children: Array.isArray(n.children)
      ? (n.children as Record<string, unknown>[]).map(groupRecordToTreeNode)
      : [],
  };
}

export function groupsToTreeNodes(input: unknown[]): GroupTreeNode[] {
  return treeNodesExpandedOnly(
    (input || []).map((n) => groupRecordToTreeNode(n as Record<string, unknown>)),
  );
}
