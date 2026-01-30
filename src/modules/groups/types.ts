export interface TaskGroup {
  id: string;
  name: string;
  color?: string;
  shareSubgroups?: boolean;
  hideTasksFromParent?: boolean;
  icon?: string;
  parentId?: string; // For hierarchical groups
  // legacy snake_case field from older exports
  parent_id?: string | null;
  createdAt: string;
}

// Re-exporting minimal task-related types is intentionally omitted here;
// `Task` and day-organiser types remain in `src/modules/day-organiser/types.ts`.
