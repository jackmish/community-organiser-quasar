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
  joinPath: (...paths: string[]) => string;
  ensureDir: (dirPath: string) => Promise<boolean>;
  readDir: (dirPath: string) => Promise<string[]>;
}

export type MaybeElectronAppdataAPI = ElectronAppdataAPI | undefined;
