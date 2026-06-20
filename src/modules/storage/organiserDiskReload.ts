import CC from 'src/CCAccess';
import logger from 'src/utils/logger';
import { ingestGroupsTaskData } from 'src/modules/media/mediaTaskStorage';
import * as taskService from 'src/modules/task/managers/taskRepository';
import { loadGroupsFromGroupDirectory } from './backend/electron/groupFileLoader';
import type { ElectronAppdataAPI } from './backend/electron/ElectronAppdataAPI';
import { shouldUseCapacitorStorage } from './backend/storagePlatform';
import { capacitorStorage } from './backend/mobile/capacitorBackend';

/**
 * Force-load groups from disk into the organiser (recovery when memory is empty but files exist).
 */
export async function reloadOrganiserFromDisk(): Promise<{ groups: number; days: number }> {
  let groups: Record<string, unknown>[] = [];

  if (shouldUseCapacitorStorage()) {
    groups = (await capacitorStorage.loadAllGroups()) as unknown as Record<string, unknown>[];
  } else {
    const api =
      typeof window !== 'undefined'
        ? (window as Window & { electronAPI?: ElectronAppdataAPI }).electronAPI
        : undefined;
    if (!api?.getAppDataPath || !api.readJsonFile || !api.joinPath) {
      return { groups: 0, days: 0 };
    }
    groups = await loadGroupsFromGroupDirectory(api);
  }

  if (!groups.length) {
    logger.warn('[organiserDiskReload] no groups read from disk');
    return { groups: 0, days: 0 };
  }

  if (CC.group?.list?.setGroups) {
    CC.group.list.setGroups(groups);
  }

  const { days, mediaTasks } = ingestGroupsTaskData(groups);
  if (CC.task?.time?.days) {
    CC.task.time.days.value = days;
  }
  taskService.setMediaTasks(mediaTasks);
  taskService.migrateMediaTasksFromDays();
  try {
    const loaded = taskService.buildFlatTasksList(days);
    taskService.flatTasks.value.splice(0, taskService.flatTasks.value.length, ...loaded);
  } catch (e) {
    void e;
  }

  return { groups: groups.length, days: Object.keys(days).length };
}
