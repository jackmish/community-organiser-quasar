/**
 * CCAccess — wires the app's domain controllers and exports the access tree.
 *
 * Two exports:
 * ────────────
 *   CC     — typed access object  → import CC from 'src/CCAccess'
 *   CCReg  — registry + boot      → import { CCReg } from 'src/CCAccess'
 *
 * Reading the registrations here tells you exactly what domains are in the app.
 * Adding a new domain is ONE line:
 *
 *   .register('calendar', CalendarStoreController)
 *
 * No other file needs to change — CCReg.boot() picks it up automatically.
 */
import { CCRegistry } from 'src/CCRegistry';
import { GroupStoreController } from 'src/modules/group/GroupController';
import { TaskStoreController } from 'src/modules/task/TaskController';

// ── Domain registration ────────────────────────────────────────────────────
// Declared in boot order. Each line = one domain.
export const CCReg = new CCRegistry()
  .register('group', GroupStoreController)
  .register('task', TaskStoreController);

// ── Access object ──────────────────────────────────────────────────────────
// CC is the public surface. CC.group / CC.task / CC.storage are fully typed
// from the registrations above — no manual type annotation needed.
export const CC = CCReg.access;

export default CC;
