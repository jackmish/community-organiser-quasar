import logger from 'src/utils/logger';

/** Persist organiser data — uses CC.storage directly so errors are not swallowed by app(). */
export async function saveData(): Promise<void> {
  const { default: CC } = await import('src/CCAccess');
  await CC.storage.saveData();
}

export default { saveData };
