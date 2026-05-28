import CC from 'src/CCAccess';
import logger from 'src/utils/logger';
import { loadGroupsFromGroupDirectory } from './backend/electron/groupFileLoader';
import type { ElectronAppdataAPI } from './backend/electron/ElectronAppdataAPI';

function daysFromGroupTasks(groups: Record<string, unknown>[]): Record<string, { date: string; tasks: unknown[]; notes: string }> {
  const days: Record<string, { date: string; tasks: unknown[]; notes: string }> = {};
  for (const grp of groups) {
    const gid = typeof grp.id === 'string' ? grp.id : '';
    if (!gid) continue;
    const tasks = Array.isArray(grp.tasks) ? grp.tasks : [];
    for (const t of tasks) {
      if (!t || typeof t !== 'object') continue;
      const row = t as Record<string, unknown>;
      const rawDate = row.date ?? row.eventDate;
      const dateKey = (
        typeof rawDate === 'string' || typeof rawDate === 'number'
          ? String(rawDate)
          : new Date().toISOString()
      ).slice(0, 10);
      if (!days[dateKey]) days[dateKey] = { date: dateKey, tasks: [], notes: '' };
      if (!row.groupId) row.groupId = gid;
      days[dateKey].tasks.push(row);
    }
  }
  return days;
}

/**
 * Force-load groups from disk into the organiser (recovery when memory is empty but AppData files exist).
 */
export async function reloadOrganiserFromDisk(): Promise<{ groups: number; days: number }> {
  const api =
    typeof window !== 'undefined' ? (window as Window & { electronAPI?: ElectronAppdataAPI }).electronAPI : undefined;
  if (!api?.getAppDataPath || !api.readJsonFile || !api.joinPath) {
    return { groups: 0, days: 0 };
  }

  const groups = await loadGroupsFromGroupDirectory(api);
  if (!groups.length) {
    logger.warn('[organiserDiskReload] no groups read from disk');
    return { groups: 0, days: 0 };
  }

  if (CC.group?.list?.setGroups) {
    CC.group.list.setGroups(groups);
  }

  const days = daysFromGroupTasks(groups);
  if (CC.task?.time?.days) {
    CC.task.time.days.value = days;
  }
  try {
    CC.task?.refreshFlatListFromDays?.();
  } catch {
    void 0;
  }

  try {
    if (CC.storage?.saveData) await CC.storage.saveData();
  } catch (e) {
    logger.error('[organiserDiskReload] saveData failed', e);
  }

  return { groups: groups.length, days: Object.keys(days).length };
}
