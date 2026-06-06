export type AppViewMode = 'calendar' | 'files';

export const APP_VIEW_MODES: AppViewMode[] = ['calendar', 'files'];

/** Legacy persisted value `media` maps to `files`. */
export function normalizeAppViewMode(value: unknown): AppViewMode {
  if (value === 'files' || value === 'media') return 'files';
  return 'calendar';
}

export function isGroupFilesModuleEnabled(
  group: { mediaEnabled?: boolean | undefined } | null | undefined,
): boolean {
  return !!group?.mediaEnabled;
}

/** @deprecated Use isGroupFilesModuleEnabled */
export const isGroupMediaEnabled = isGroupFilesModuleEnabled;
