/**
 * Minimal .env loader for Electron main process.
 * Reads the .env file from the project root and merges into process.env
 * (only sets vars that are not already defined).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __loadDotEnvDir = path.dirname(fileURLToPath(import.meta.url));

export function loadDotEnv(): void {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__loadDotEnvDir, '..', '.env'),
    path.resolve(__loadDotEnvDir, '../../.env'),
  ];

  for (const envPath of candidates) {
    try {
      if (!fs.existsSync(envPath)) continue;
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx < 1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!(key in process.env)) {
          process.env[key] = val;
        }
      }
      return;
    } catch {
      continue;
    }
  }
}
