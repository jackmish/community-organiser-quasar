export const AI_SERVER_CHANGED_EVENT = 'co21:ai-server-changed';

export const DEFAULT_AI_SERVER_BASE_URL = 'http://127.0.0.1:8000';

export type AiServerStatus = {
  running: boolean;
  pid: number | null;
  baseUrl: string;
  backendPath: string;
  startedAt: number | null;
  lastError: string;
};

export type AiServerDefaultConfig = {
  backendPath: string;
  pythonPath: string;
  managePyPath: string;
  baseUrl: string;
  port: number;
  found: boolean;
};
