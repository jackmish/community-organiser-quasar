/** Subfolder name created inside the user-selected root (modes b/c). */
export const CO21_WORKSPACE_DIR_NAME = 'co21-workspace';

export type WorkspaceCreateMode = 'blank' | 'folder_manager' | 'many_containers';

export type WorkspaceBrowseKind = 'files' | 'gallery';

export function isWorkspaceCreateMode(value: unknown): value is WorkspaceCreateMode {
  return value === 'blank' || value === 'folder_manager' || value === 'many_containers';
}
