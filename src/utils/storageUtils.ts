import { app } from 'src/services/appService';

export async function appSaveData(): Promise<void> {
  const s = app('storage');
  if (!s) return;
  // app proxy wraps methods and errors — simply call saveData
  await s.saveData();
}

export default { appSaveData };
