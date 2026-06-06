export interface ActiveStorageContext {
  dataPath: string;
  storageMode: 'files' | 'sqlite';
  dbPath: string;
  sqliteReady: boolean;
}

export interface ElectronAppdataAPI {
  readFile?: (filePath: string) => Promise<string | null>;
  readJsonFile: (filePath: string) => Promise<any>;
  writeJsonFile: (filePath: string, data: any) => Promise<boolean>;
  writeFile: (filePath: string, data: string) => Promise<boolean>;
  writeFileBinary?: (
    filePath: string,
    base64: string,
    mime?: string,
  ) => Promise<{ mime: string }>;
  readFileBase64?: (filePath: string) => Promise<{ base64: string; mime: string }>;
  removePath?: (targetPath: string) => Promise<boolean>;
  deleteFile: (filePath: string) => Promise<boolean>;
  fileExists: (filePath: string) => Promise<boolean>;
  getAppDataPath: () => Promise<string>;
  getStorageContext?: () => Promise<ActiveStorageContext>;
  loadGroupsSqlite?: () => Promise<Record<string, unknown>[]>;
  saveGroupsSqlite?: (groups: unknown[]) => Promise<{ ok: boolean }>;
  deleteGroupSqlite?: (groupId: string) => Promise<{ ok: boolean }>;
  loadSettingsSqlite?: () => Promise<Record<string, unknown>>;
  saveSettingsSqlite?: (settings: Record<string, unknown>) => Promise<{ ok: boolean }>;
  loadCo21SettingsSqlite?: () => Promise<Record<string, unknown>>;
  saveCo21SettingsSqlite?: (settings: Record<string, unknown>) => Promise<{ ok: boolean }>;
  joinPath: (...paths: string[]) => string;
  ensureDir: (dirPath: string) => Promise<boolean>;
  readDir: (dirPath: string) => Promise<string[]>;
  showOpenFolder?: () => Promise<string | null>;
}

export type MaybeElectronAppdataAPI = ElectronAppdataAPI | undefined;

async function activeSqliteStorage(): Promise<boolean> {
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
  if (!api?.getStorageContext) return false;
  try {
    const ctx = await api.getStorageContext();
    return ctx.storageMode === 'sqlite' && ctx.sqliteReady;
  } catch {
    return false;
  }
}

export async function isActiveSpaceSqliteStorage(): Promise<boolean> {
  return activeSqliteStorage();
}
