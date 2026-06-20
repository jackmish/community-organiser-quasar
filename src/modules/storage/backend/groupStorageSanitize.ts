import logger from 'src/utils/logger';

function sanitizeJsonReplacer() {
  const seen = new WeakSet<object>();
  return function (k: string, v: unknown) {
    if (typeof v === 'object' && v !== null) {
      if (seen.has(v)) return undefined;
      seen.add(v);
    }
    if (typeof v === 'function') return undefined;
    if (k && k.startsWith('_')) return undefined;
    return v;
  };
}

function sanitizeJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, sanitizeJsonReplacer())) as T;
}

function prepareGroupForDisk(group: Record<string, unknown>): Record<string, unknown> {
  const safeTasks = Array.isArray(group.tasks)
    ? group.tasks.map((task: Record<string, unknown>) => {
        const t = { ...task, groupId: group.id };
        if ('_group' in t) delete t._group;
        return t;
      })
    : undefined;
  const safeMediaTasks = Array.isArray(group.mediaTasks)
    ? group.mediaTasks.map((task: Record<string, unknown>) => {
        const t = { ...task, groupId: group.id };
        if ('_group' in t) delete t._group;
        return t;
      })
    : undefined;
  const groupToWrite = { ...group };
  if (safeTasks !== undefined) groupToWrite.tasks = safeTasks;
  if (safeMediaTasks !== undefined) groupToWrite.mediaTasks = safeMediaTasks;
  return groupToWrite;
}

export async function sanitizeGroupsForStorage(
  groups: unknown[],
): Promise<Record<string, unknown>[]> {
  const { prepareGroupBackgroundForDisk } = await import(
    'src/modules/group/utils/groupBackgroundStorage'
  );
  const sanitized: Record<string, unknown>[] = [];
  for (const group of groups) {
    if (!group || typeof group !== 'object') continue;
    const groupToWrite = prepareGroupForDisk(group as Record<string, unknown>);
    try {
      await prepareGroupBackgroundForDisk(
        groupToWrite as {
          id: string;
          backgroundImage?: string | null;
          background_image?: string | null;
        },
      );
    } catch (err) {
      logger.warn('[groupStorageSanitize] group background persist failed', groupToWrite.id, err);
    }
    sanitized.push(sanitizeJsonValue(groupToWrite));
  }
  return sanitized;
}
