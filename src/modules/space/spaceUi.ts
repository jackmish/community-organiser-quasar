export const OPEN_SPACES_DIALOG_EVENT = 'co21:open-spaces';
export const OPEN_CONNECTIONS_DIALOG_EVENT = 'co21:open-connections';

export type OpenSpacesDialogMode = 'create' | 'locate' | 'relocate';

export type OpenSpacesDialogDetail = {
  mode?: OpenSpacesDialogMode;
  spaceId?: string;
  /** After register/locate, switch to that space and restart. */
  switchAfter?: boolean;
};

export function dispatchOpenSpacesDialog(detail?: OpenSpacesDialogDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_SPACES_DIALOG_EVENT, { detail: detail ?? {} }));
}

export function dispatchOpenConnectionsDialog(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(OPEN_CONNECTIONS_DIALOG_EVENT));
}
