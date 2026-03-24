import type { DayData } from '../task/models/classes/DayData';
import type { Group } from '../group/models/GroupModel';

export class OrganiserData {
  days: Record<string, DayData>;
  groups: Group[];
  lastModified: string;

  constructor(init?: Partial<OrganiserData>) {
    this.days = init?.days ?? {};
    this.groups = init?.groups ?? [];
    this.lastModified = init?.lastModified ?? new Date().toISOString();
  }
}

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
