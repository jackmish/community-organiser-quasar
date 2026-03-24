export interface ElectronAPI {
  readJsonFile: (filePath: string) => Promise<any>;
  writeJsonFile: (filePath: string, data: any) => Promise<boolean>;
  writeFile: (filePath: string, data: string) => Promise<boolean>;
  deleteFile: (filePath: string) => Promise<boolean>;
  fileExists: (filePath: string) => Promise<boolean>;
  getAppDataPath: () => Promise<string>;
  joinPath: (...paths: string[]) => string;
  ensureDir: (dirPath: string) => Promise<boolean>;
  readDir: (dirPath: string) => Promise<string[]>;
}

export type MaybeElectronAPI = ElectronAPI | undefined;
