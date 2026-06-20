import logger from 'src/utils/logger';
import type { ElectronAppdataAPI } from './ElectronAppdataAPI';

/** `group-<id>.json` in storage/group (case-insensitive extension on Windows). */
export function getGroupFilename(groupId: string): string {
  return `group-${groupId}.json`;
}

/** `group-<id>.json` in storage/group (case-insensitive extension on Windows). */
export function isGroupJsonFilename(file: string): boolean {
  const name = String(file || '').trim();
  if (!name) return false;
  const lower = name.toLowerCase();
  return lower.startsWith('group-') && lower.endsWith('.json');
}

/** Extract group id from a `group-<id>.json` filename. */
export function groupIdFromGroupFilename(file: string): string | null {
  if (!isGroupJsonFilename(file)) return null;
  const id = file.slice('group-'.length, file.length - '.json'.length).trim();
  return id || null;
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Parse group JSON from disk; returns null when empty or invalid. */
export function parseGroupJsonText(text: string): Record<string, unknown> | null {
  const trimmed = stripBom(String(text || '').trim());
  if (!trimmed) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch (e) {
    logger.error('[groupFileLoader] JSON parse failed', e);
    return null;
  }
}

/** Normalize a row loaded from disk (id from body or filename). */
export function normalizeGroupFromDisk(
  raw: Record<string, unknown> | null,
  filename: string,
): Record<string, unknown> | null {
  if (!raw) return null;
  const idFromFile = groupIdFromGroupFilename(filename);
  const id =
    (typeof raw.id === 'string' && raw.id.trim()) ||
    (typeof raw.groupId === 'string' && raw.groupId.trim()) ||
    idFromFile ||
    '';
  if (!id) {
    logger.warn('[groupFileLoader] skip file without group id', filename);
    return null;
  }
  const name =
    (typeof raw.name === 'string' && raw.name.trim()) ||
    (typeof raw.label === 'string' && raw.label.trim()) ||
    id;
  const tasks = Array.isArray(raw.tasks) ? raw.tasks : [];
  const mediaTasks = Array.isArray(raw.mediaTasks) ? raw.mediaTasks : [];
  return { ...raw, id, name, tasks, mediaTasks };
}

async function readGroupFile(
  api: ElectronAppdataAPI,
  filePath: string,
  filename: string,
): Promise<Record<string, unknown> | null> {
  let parsed = await api.readJsonFile(filePath);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    try {
      const text = await (api as ElectronAppdataAPI & { readFile?: (p: string) => Promise<string> })
        .readFile?.(filePath);
      if (typeof text === 'string') {
        parsed = parseGroupJsonText(text);
      }
    } catch {
      void 0;
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    logger.warn('[groupFileLoader] unreadable group file', filename);
    return null;
  }
  return normalizeGroupFromDisk(parsed as Record<string, unknown>, filename);
}

/** Load all group-*.json files from storage/group under app userData. */
export async function loadGroupsFromGroupDirectory(
  api: ElectronAppdataAPI,
): Promise<Record<string, unknown>[]> {
  const appDataDir = await api.getAppDataPath();
  const groupDir = api.joinPath(appDataDir, 'storage', 'group');
  await api.ensureDir(groupDir);
  const files = await api.readDir(groupDir);
  const groups: Record<string, unknown>[] = [];
  let skipped = 0;

  for (const file of files || []) {
    if (typeof file !== 'string' || !isGroupJsonFilename(file)) continue;
    const filePath = api.joinPath(groupDir, file);
    try {
      const row = await readGroupFile(api, filePath, file);
      if (row) groups.push(row);
      else skipped += 1;
    } catch (err) {
      skipped += 1;
      logger.error('[groupFileLoader] read failed', filePath, err);
    }
  }

  logger.debug('[groupFileLoader] loaded', groups.length, 'skipped', skipped, 'dir', groupDir);
  return groups;
}
