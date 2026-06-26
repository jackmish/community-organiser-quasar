export const CO21_SERVER_CHANGED_EVENT = 'co21:server-changed';

/** @deprecated Use CO21_SERVER_CHANGED_EVENT */
export const AI_SERVER_CHANGED_EVENT = CO21_SERVER_CHANGED_EVENT;

export const DEFAULT_CO21_SERVER_BASE_URL = 'http://127.0.0.1:8000';

/** @deprecated Use DEFAULT_CO21_SERVER_BASE_URL */
export const DEFAULT_AI_SERVER_BASE_URL = DEFAULT_CO21_SERVER_BASE_URL;

export type Co21ServerStatus = {
  running: boolean;
  pid: number | null;
  baseUrl: string;
  backendPath: string;
  startedAt: number | null;
  lastError: string;
};

/** @deprecated Use Co21ServerStatus */
export type AiServerStatus = Co21ServerStatus;

export type Co21ServerDefaultConfig = {
  backendPath: string;
  pythonPath: string;
  managePyPath: string;
  baseUrl: string;
  port: number;
  found: boolean;
};

/** @deprecated Use Co21ServerDefaultConfig */
export type AiServerDefaultConfig = Co21ServerDefaultConfig;
