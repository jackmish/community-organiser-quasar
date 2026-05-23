import { $text } from 'src/modules/lang';
import type { RolePrivilege } from './RoleModel';

export function labelRolePrivilege(p: RolePrivilege): string {
  switch (p) {
    case 'preview':
      return $text('role.priv_show');
    case 'work':
      return $text('role.priv_work');
    case 'edit':
      return $text('role.priv_edit');
    case 'full':
      return $text('role.priv_full');
    default:
      return p;
  }
}
