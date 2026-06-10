/**
 * Subfolder name created inside the user-selected root (modes b/c).
 * Leading `~` is keyboard-friendly and sorts after `_` tag folders in file browsers.
 */
export const CO21_WORKSPACE_DIR_NAME = '~co21-workspace';

/** Older folder names; still recognized when browsing existing projects. */
export const LEGACY_CO21_WORKSPACE_DIR_NAMES = ['co21-workspace', '_co21-workspace'] as const;

export const CO21_WORKSPACE_DIR_NAMES = [
  CO21_WORKSPACE_DIR_NAME,
  ...LEGACY_CO21_WORKSPACE_DIR_NAMES,
] as const;

export function isCo21WorkspaceDirName(name: string): boolean {
  const n = String(name || '').trim();
  return (CO21_WORKSPACE_DIR_NAMES as readonly string[]).includes(n);
}

export type WorkspaceCreateMode = 'blank' | 'folder_manager' | 'many_containers';

export type WorkspaceBrowseKind = 'files' | 'gallery';

export function isWorkspaceCreateMode(value: unknown): value is WorkspaceCreateMode {
  return value === 'blank' || value === 'folder_manager' || value === 'many_containers';
}
