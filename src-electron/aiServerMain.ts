import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from 'src/utils/logger';

const __aiServerDir = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = 8000;
const DEFAULT_BASE_URL = `http://127.0.0.1:${DEFAULT_PORT}`;

let child: ChildProcess | null = null;
let startedAt: number | null = null;
let lastError = '';
let activeBaseUrl = DEFAULT_BASE_URL;
let activeBackendPath = '';

export type AiServerDefaultConfig = {
  backendPath: string;
  pythonPath: string;
  managePyPath: string;
  baseUrl: string;
  port: number;
  found: boolean;
};

export type AiServerStatus = {
  running: boolean;
  pid: number | null;
  baseUrl: string;
  backendPath: string;
  startedAt: number | null;
  lastError: string;
};

function isValidBackendRoot(backendPath: string): boolean {
  return fs.existsSync(path.join(backendPath, 'manage.py'));
}

function discoverBackendPythonRoot(): string | null {
  let dir = __aiServerDir;
  for (let depth = 0; depth < 8; depth++) {
    const candidate = path.join(dir, 'backend-python');
    if (isValidBackendRoot(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function resolveBackendRoot(customPath?: string): string {
  const trimmed = String(customPath || process.env.CO21_BACKEND_PYTHON_PATH || '').trim();
  if (trimmed) {
    const resolved = path.resolve(trimmed);
    if (isValidBackendRoot(resolved)) return resolved;
  }

  const discovered = discoverBackendPythonRoot();
  if (discovered) return discovered;

  // Monorepo default: backend-python next to app-quasar at repo root.
  return path.resolve(__aiServerDir, '../../../backend-python');
}

export function getAiServerDefaultConfig(customPath?: string): AiServerDefaultConfig {
  const backendPath = resolveBackendRoot(customPath);
  const pythonPath = path.join(backendPath, '.venv/bin/python');
  const managePyPath = path.join(backendPath, 'manage.py');
  const port = Number(process.env.CO21_AI_SERVER_PORT || DEFAULT_PORT) || DEFAULT_PORT;
  const baseUrl = String(process.env.CO21_AI_SERVER_URL || `http://127.0.0.1:${port}`).replace(/\/$/, '');
  const found = fs.existsSync(pythonPath) && fs.existsSync(managePyPath);
  return { backendPath, pythonPath, managePyPath, baseUrl, port, found };
}

function httpGet(url: string, timeoutMs = 4000): Promise<{ ok: boolean; status: number }> {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const req = http.request(
        {
          hostname: parsed.hostname,
          port: parsed.port || 80,
          path: parsed.pathname + parsed.search,
          method: 'GET',
          timeout: timeoutMs,
        },
        (res) => {
          res.resume();
          resolve({ ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300, status: res.statusCode ?? 0 });
        },
      );
      req.on('error', () => resolve({ ok: false, status: 0 }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ ok: false, status: 0 });
      });
      req.end();
    } catch {
      resolve({ ok: false, status: 0 });
    }
  });
}

async function waitForHealth(baseUrl: string, timeoutMs = 45_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const healthUrl = `${baseUrl.replace(/\/$/, '')}/api/v1/health`;
  while (Date.now() < deadline) {
    const res = await httpGet(healthUrl, 3000);
    if (res.ok) return;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('CO21 backend server did not become ready in time');
}

function runPipInstall(config: AiServerDefaultConfig): Promise<void> {
  const reqFile = path.join(config.backendPath, 'requirements.txt');
  if (!fs.existsSync(reqFile)) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const proc = spawn(
      config.pythonPath,
      ['-m', 'pip', 'install', '-q', '-r', reqFile],
      {
        cwd: config.backendPath,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let stderr = '';
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `pip install failed (${code})`));
    });
  });
}

function runManagePy(
  config: AiServerDefaultConfig,
  args: string[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(config.pythonPath, [config.managePyPath, ...args], {
      cwd: config.backendPath,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `manage.py ${args.join(' ')} failed (${code})`));
    });
  });
}

export function getAiServerStatus(): AiServerStatus {
  return {
    running: child !== null && !child.killed,
    pid: child?.pid ?? null,
    baseUrl: activeBaseUrl,
    backendPath: activeBackendPath,
    startedAt,
    lastError,
  };
}

export async function checkAiServerHealth(baseUrl = activeBaseUrl): Promise<boolean> {
  const res = await httpGet(`${baseUrl.replace(/\/$/, '')}/api/v1/health`);
  return res.ok;
}

export async function startAiServer(options?: {
  backendPath?: string;
  baseUrl?: string;
}): Promise<AiServerStatus> {
  if (child && !child.killed) {
    return getAiServerStatus();
  }

  const config = getAiServerDefaultConfig(options?.backendPath);
  activeBackendPath = config.backendPath;
  activeBaseUrl = String(options?.baseUrl || config.baseUrl).replace(/\/$/, '');

  if (!config.found) {
    lastError = `Python backend not found at ${config.backendPath}`;
    throw new Error(lastError);
  }

  lastError = '';
  logger.info('[backend-server] install deps', config.backendPath);
  await runPipInstall(config);
  logger.info('[backend-server] migrate', config.backendPath);
  await runManagePy(config, ['migrate', '--noinput']);
  logger.info('[backend-server] clear recognition sessions');
  await runManagePy(config, ['clear_recognition_sessions']);

  const port = new URL(activeBaseUrl).port || String(DEFAULT_PORT);
  logger.info('[backend-server] start', activeBaseUrl, config.backendPath);
  child = spawn(
    config.pythonPath,
    [config.managePyPath, 'runserver', `127.0.0.1:${port}`, '--noreload'],
    {
      cwd: config.backendPath,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  startedAt = Date.now();
  const proc = child;

  proc.stdout?.on('data', (chunk: Buffer) => {
    logger.debug('[backend-server:stdout]', chunk.toString('utf8').trim());
  });
  proc.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf8').trim();
    if (text) logger.warn('[backend-server:stderr]', text);
  });
  proc.on('error', (err) => {
    lastError = err.message;
    logger.error('[backend-server] process error', err);
  });
  proc.on('close', (code) => {
    logger.info('[backend-server] stopped', code);
    child = null;
    startedAt = null;
    if (code && code !== 0 && !lastError) {
      lastError = `Server exited with code ${code}`;
    }
  });

  try {
    await waitForHealth(activeBaseUrl);
  } catch (err) {
    stopAiServer();
    lastError = err instanceof Error ? err.message : String(err);
    throw err;
  }

  return getAiServerStatus();
}

export function stopAiServer(): AiServerStatus {
  if (child && !child.killed) {
    child.kill('SIGTERM');
    setTimeout(() => {
      if (child && !child.killed) child?.kill('SIGKILL');
    }, 2500);
  }
  child = null;
  startedAt = null;
  return getAiServerStatus();
}
