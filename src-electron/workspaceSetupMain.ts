import fs from 'fs';
import path from 'path';
import { randomUUID } from 'node:crypto';
import { DEFAULT_GALLERY_TAG_SET } from '../src/modules/media/mediaGalleryTagModel';
import { MEDIA_TASK_TYPE } from '../src/modules/media/mediaTaskTypes';
import {
  CO21_WORKSPACE_DIR_NAME,
  CO21_WORKSPACE_DIR_NAMES,
  type WorkspaceBrowseKind,
  type WorkspaceCreateMode,
} from '../src/modules/space/models/workspaceSetupModel';
import type { SpaceEntry } from '../src/modules/space/models/SpaceModel';
import { APP_DATA_PATH_SEGMENTS } from '../src/modules/storage/appDataPaths';
import { createCustomSpace } from './spaceRegistryMain';

const IMAGE_FILE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.svg',
  '.avif',
  '.heic',
  '.heif',
]);

const GALLERY_FILTER_FOLDER_NAMES = new Set([
  '_ToRemove',
  '_Unsupported',
  '_BadQuality',
  '_Rate1',
  '_Rate2',
  '_Rate3',
]);

type DirEntry = { name: string; isDirectory: boolean; isFile: boolean };

function isImageFileName(name: string): boolean {
  const lower = String(name || '').toLowerCase();
  const dot = lower.lastIndexOf('.');
  if (dot <= 0) return false;
  return IMAGE_FILE_EXTENSIONS.has(lower.slice(dot));
}

function isGalleryFilterFolderName(name: string): boolean {
  const trimmed = String(name || '').trim();
  if (!trimmed) return false;
  if (GALLERY_FILTER_FOLDER_NAMES.has(trimmed)) return true;
  return trimmed.startsWith('_') && trimmed.length > 1;
}

function listTopLevelEntries(dirPath: string): DirEntry[] {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true }).map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile(),
    }));
  } catch {
    return [];
  }
}

/** Top-level only: first image file or gallery filter folders => gallery mode. */
export function detectBrowseKindForFolder(dirPath: string): WorkspaceBrowseKind {
  const resolved = path.resolve(String(dirPath || '').trim());
  if (!resolved || !fs.existsSync(resolved)) return 'files';

  const entries = listTopLevelEntries(resolved);
  for (const entry of entries) {
    if (entry.isDirectory && isGalleryFilterFolderName(entry.name)) {
      return 'gallery';
    }
  }

  const firstFile = entries.find((e) => e.isFile);
  if (firstFile && isImageFileName(firstFile.name)) {
    return 'gallery';
  }

  return 'files';
}

function listImmediateSubdirectories(rootPath: string, excludeNames: Set<string>): string[] {
  const resolved = path.resolve(String(rootPath || '').trim());
  if (!resolved || !fs.existsSync(resolved)) return [];

  return listTopLevelEntries(resolved)
    .filter((e) => e.isDirectory && !excludeNames.has(e.name))
    .map((e) => path.join(resolved, e.name));
}

function generateGroupId(groupName: string): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);
  const dateStr = `${day}${month}${year}`;
  const words = groupName.trim().split(/\s+/);
  const initials = words.map((w) => w[0]).join('').toLowerCase();
  const hash = randomUUID().replace(/-/g, '').slice(0, 6);
  return `${initials}${hash}${dateStr}`;
}

function generateTaskId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildMediaTask(
  groupId: string,
  taskName: string,
  folderPath: string,
  browseKind: WorkspaceBrowseKind,
): Record<string, unknown> {
  const now = new Date().toISOString();
  const isGallery = browseKind === 'gallery';
  return {
    id: generateTaskId(),
    name: taskName,
    description: '',
    date: todayDateKey(),
    category: 'other',
    priority: 'medium',
    type_id: isGallery ? MEDIA_TASK_TYPE.Gallery : MEDIA_TASK_TYPE.Files,
    groupId,
    mediaSharedFolderPath: path.resolve(folderPath),
    ...(isGallery ? { galleryTagSet: DEFAULT_GALLERY_TAG_SET } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

function writeBootstrapGroupFile(
  workspaceDataPath: string,
  groupName: string,
  managedFolders: Array<{ folderPath: string; taskName: string }>,
): void {
  const groupId = generateGroupId(groupName);
  const now = new Date().toISOString();
  const mediaTasks = managedFolders.map((item) =>
    buildMediaTask(
      groupId,
      item.taskName,
      item.folderPath,
      detectBrowseKindForFolder(item.folderPath),
    ),
  );

  const groupRecord = {
    id: groupId,
    name: groupName,
    createdAt: now,
    mediaEnabled: true,
    tasks: [],
    mediaTasks,
  };

  const groupDir = path.join(workspaceDataPath, ...APP_DATA_PATH_SEGMENTS.group);
  fs.mkdirSync(groupDir, { recursive: true });
  const filePath = path.join(groupDir, `group-${groupId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(groupRecord, null, 2), 'utf8');
}

function resolveWorkspaceDataPath(mode: WorkspaceCreateMode, folderPath: string): string {
  const trimmed = path.resolve(String(folderPath || '').trim());
  if (!trimmed) throw new Error('Folder is required');
  if (!fs.existsSync(trimmed)) throw new Error('Folder does not exist');

  if (mode === 'blank') {
    return trimmed;
  }

  return path.join(trimmed, CO21_WORKSPACE_DIR_NAME);
}

function buildManagedFolders(
  mode: WorkspaceCreateMode,
  folderPath: string,
  workspaceName: string,
): Array<{ folderPath: string; taskName: string }> {
  const contentRoot = path.resolve(folderPath.trim());

  if (mode === 'folder_manager') {
    const baseName = path.basename(contentRoot) || workspaceName;
    return [{ folderPath: contentRoot, taskName: baseName }];
  }

  if (mode === 'many_containers') {
    const exclude = new Set(CO21_WORKSPACE_DIR_NAMES);
    const subdirs = listImmediateSubdirectories(contentRoot, exclude);
    if (!subdirs.length) {
      throw new Error('No subfolders found in the selected folder');
    }
    return subdirs.map((subdir) => ({
      folderPath: subdir,
      taskName: path.basename(subdir) || subdir,
    }));
  }

  return [];
}

export function createCustomSpaceWithSetup(
  name: string,
  payload: { mode: WorkspaceCreateMode; folderPath: string },
): SpaceEntry {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error('Space name is required');

  const mode = payload.mode;
  const workspaceDataPath = resolveWorkspaceDataPath(mode, payload.folderPath);

  if (mode !== 'blank' && fs.existsSync(workspaceDataPath)) {
    const entries = fs.readdirSync(workspaceDataPath);
    if (entries.length > 0) {
      throw new Error('Workspace folder already exists and is not empty');
    }
  }

  const entry = createCustomSpace(trimmedName, workspaceDataPath);

  if (mode === 'blank') {
    return entry;
  }

  const managedFolders = buildManagedFolders(mode, payload.folderPath, trimmedName);
  writeBootstrapGroupFile(workspaceDataPath, trimmedName, managedFolders);
  return entry;
}
