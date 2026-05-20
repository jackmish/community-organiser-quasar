/** Global event to open Roles & privileges (MainLayout). */
export const ROLES_SETUP_OPEN_EVENT = 'co21:open-roles-setup';

export type RolesSetupOpenDetail = {
  /** When true, dialog opens with a new role ready to configure (unsaved until Save). */
  createNew?: boolean;
};

export function dispatchOpenRolesSetup(detail: RolesSetupOpenDetail = {}): void {
  window.dispatchEvent(
    new CustomEvent<RolesSetupOpenDetail>(ROLES_SETUP_OPEN_EVENT, { detail }),
  );
}

export function rolesSetupOpenCreateNew(ev: Event): boolean {
  const detail = (ev as CustomEvent<RolesSetupOpenDetail>).detail;
  return !!detail?.createNew;
}
