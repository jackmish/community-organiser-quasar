import type { IpcMain } from 'electron';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type {
  Co21UnixPartitionMountEntry,
  MediaFolderMountHint,
  MediaFolderMountReason,
  UnixPartitionMountBinding,
} from '../src/modules/media/unixPartitionMountModel';
import { CO21_UNIX_PARTITION_MOUNTS_KEY } from '../src/modules/media/unixPartitionMountModel';
import { APP_DATA_PATH_SEGMENTS } from '../src/modules/storage/appDataPaths';
import { resolveActiveDataPath } from './spaceRegistryMain';
import { loadCo21SettingsFromSqlite } from './spaceSqliteMain';

const execFileAsync = promisify(execFile);

const SKIP_FS_TYPES = new Set(['swap', 'none']);
const LINUX = process.platform === 'linux';

function normalizeMountPath(mountPoint: string): string {
  return path.resolve(String(mountPoint || '').trim());
}

function bindingLabel(binding: UnixPartitionMountBinding): string {
  const custom = String(binding.label || '').trim();
  if (custom) return custom;
  const base = path.basename(binding.mountPoint);
  if (base && base !== '/') return base;
  return binding.mountPoint;
}

function parseFstabOptions(raw: string): string[] {
  return String(raw || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseFstabLine(line: string): UnixPartitionMountBinding | null {
  const trimmed = String(line || '').trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const parts = trimmed.split(/\s+/);
  if (parts.length < 4) return null;

  const device = parts[0]!;
  const mountPoint = parts[1]!;
  const fsType = parts[2]!;
  const options = parseFstabOptions(parts[3]!);

  if (!device || !mountPoint || mountPoint === 'none') return null;
  if (SKIP_FS_TYPES.has(fsType.toLowerCase())) return null;
  if (device.startsWith('#')) return null;

  return {
    device,
    mountPoint: normalizeMountPath(mountPoint),
    fsType,
    options,
    label: path.basename(mountPoint) || mountPoint,
  };
}

function readFstabFile(filePath: string): UnixPartitionMountBinding[] {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const bindings: UnixPartitionMountBinding[] = [];
    for (const line of raw.split(/\r?\n/)) {
      const binding = parseFstabLine(line);
      if (binding) bindings.push(binding);
    }
    return bindings;
  } catch {
    return [];
  }
}

function readFstabBindings(): UnixPartitionMountBinding[] {
  if (!LINUX) return [];
  const bindings = [...readFstabFile('/etc/fstab')];
  try {
    const dir = '/etc/fstab.d';
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.fstab') && !name.endsWith('.conf')) continue;
      bindings.push(...readFstabFile(path.join(dir, name)));
    }
  } catch {
    // ignore
  }
  return bindings;
}

function readSettingsBindings(): UnixPartitionMountBinding[] {
  try {
    const dataPath = resolveActiveDataPath();
    const settings = loadCo21SettingsFromSqlite(dataPath);
    const raw = settings[CO21_UNIX_PARTITION_MOUNTS_KEY];
    if (!Array.isArray(raw)) return [];

    const bindings: UnixPartitionMountBinding[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const entry = item as Co21UnixPartitionMountEntry;
      const mountPoint = normalizeMountPath(entry.mountPoint);
      const device = String(entry.device || '').trim();
      if (!mountPoint || !device) continue;
      bindings.push({
        mountPoint,
        device,
        fsType: String(entry.fsType || 'auto').trim() || 'auto',
        options: [],
        label: String(entry.label || '').trim() || path.basename(mountPoint) || mountPoint,
      });
    }
    return bindings;
  } catch {
    return [];
  }
}

function loadMountBindings(): UnixPartitionMountBinding[] {
  const byMountPoint = new Map<string, UnixPartitionMountBinding>();
  for (const binding of readFstabBindings()) {
    byMountPoint.set(binding.mountPoint, binding);
  }
  for (const binding of readSettingsBindings()) {
    byMountPoint.set(binding.mountPoint, binding);
  }
  return [...byMountPoint.values()].sort(
    (a, b) => b.mountPoint.length - a.mountPoint.length,
  );
}

function readMountedPoints(): Set<string> {
  const mounted = new Set<string>();
  if (!LINUX) return mounted;
  try {
    const raw = fs.readFileSync('/proc/mounts', 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split(/\s+/);
      if (parts.length < 2) continue;
      mounted.add(normalizeMountPath(parts[1]!));
    }
  } catch {
    // ignore
  }
  return mounted;
}

function isMountPointActive(mountPoint: string, mounted = readMountedPoints()): boolean {
  return mounted.has(normalizeMountPath(mountPoint));
}

export function findMountBindingForPath(
  folderPath: string,
  bindings = loadMountBindings(),
): UnixPartitionMountBinding | null {
  const candidates = resolveMountCandidatesForPath(folderPath, bindings);
  return candidates[0] ?? null;
}

/** All fstab/settings bindings that may cover this folder (longest mount point first). */
export function resolveMountCandidatesForPath(
  folderPath: string,
  bindings = loadMountBindings(),
): UnixPartitionMountBinding[] {
  const resolved = normalizeMountPath(folderPath);
  if (!resolved) return [];

  const found = new Map<string, UnixPartitionMountBinding>();

  for (const binding of bindings) {
    const mountPoint = normalizeMountPath(binding.mountPoint);
    if (resolved === mountPoint || resolved.startsWith(`${mountPoint}${path.sep}`)) {
      found.set(mountPoint, binding);
    }
  }

  let walk = resolved;
  while (walk && walk !== path.sep) {
    for (const binding of bindings) {
      const mountPoint = normalizeMountPath(binding.mountPoint);
      if (mountPoint === walk) {
        found.set(mountPoint, binding);
      }
    }
    const parent = path.dirname(walk);
    if (parent === walk) break;
    walk = parent;
  }

  return [...found.values()].sort(
    (a, b) => normalizeMountPath(b.mountPoint).length - normalizeMountPath(a.mountPoint).length,
  );
}

async function canAccessDirectory(dirPath: string): Promise<boolean> {
  try {
    await fs.promises.access(dirPath, fs.constants.R_OK | fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function buildHint(
  folderPath: string,
  binding: UnixPartitionMountBinding | null,
  reason: MediaFolderMountReason,
  candidates: UnixPartitionMountBinding[],
): MediaFolderMountHint {
  const primary = binding ?? candidates[0] ?? null;
  const mountPoint = primary ? normalizeMountPath(primary.mountPoint) : '';
  const mountLabel = primary
    ? bindingLabel(primary)
    : path.basename(normalizeMountPath(folderPath)) || normalizeMountPath(folderPath);
  const canTryMount =
    LINUX &&
    (reason === 'not_mounted' || reason === 'missing_binding') &&
    (!!primary || candidates.length > 0 || !!folderPath);

  return {
    forbidden: true,
    canTryMount,
    mountPoint,
    mountLabel,
    reason,
    ...(folderPath ? { folderPath: normalizeMountPath(folderPath) } : {}),
  };
}

export async function assessMediaFolderAccess(folderPath: string): Promise<
  | { accessible: true }
  | { accessible: false; hint: MediaFolderMountHint }
> {
  const resolved = normalizeMountPath(folderPath);
  if (!resolved) {
    return {
      accessible: false,
      hint: buildHint('', null, 'missing_binding', []),
    };
  }

  if (await canAccessDirectory(resolved)) {
    return { accessible: true };
  }

  const bindings = loadMountBindings();
  const candidates = resolveMountCandidatesForPath(resolved, bindings);
  const binding = candidates[0] ?? null;
  const mountedPoints = readMountedPoints();

  if (binding) {
    const mountPoint = normalizeMountPath(binding.mountPoint);
    const mountActive = isMountPointActive(mountPoint, mountedPoints);
    if (!mountActive) {
      return {
        accessible: false,
        hint: buildHint(resolved, binding, 'not_mounted', candidates),
      };
    }
    return {
      accessible: false,
      hint: buildHint(resolved, binding, 'permission_denied', candidates),
    };
  }

  return {
    accessible: false,
    hint: buildHint(resolved, null, 'missing_binding', candidates),
  };
}

export function enrichMediaFolderListError(
  folderPath: string,
  baseError: string,
): {
  error: string;
  forbidden?: boolean;
  canTryMount?: boolean;
  mountPoint?: string;
  mountLabel?: string;
  folderPath?: string;
} {
  const resolved = normalizeMountPath(folderPath);
  const candidates = resolveMountCandidatesForPath(resolved);
  const binding = candidates[0] ?? null;

  if (binding) {
    const mountPoint = normalizeMountPath(binding.mountPoint);
    const mounted = isMountPointActive(mountPoint);
    if (!mounted) {
      const label = bindingLabel(binding);
      return {
        error: `Partition "${label}" is not mounted (${mountPoint})`,
        forbidden: true,
        canTryMount: LINUX,
        mountPoint,
        mountLabel: label,
        folderPath: resolved,
      };
    }
  }

  if (!LINUX) {
    return { error: baseError };
  }

  return {
    error: baseError,
    forbidden: true,
    canTryMount: true,
    mountPoint: binding ? normalizeMountPath(binding.mountPoint) : '',
    mountLabel: binding
      ? bindingLabel(binding)
      : path.basename(resolved) || resolved,
    folderPath: resolved,
  };
}

async function applyMountBinding(
  binding: UnixPartitionMountBinding,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const targetMountPoint = normalizeMountPath(binding.mountPoint);
  if (isMountPointActive(targetMountPoint)) {
    return { ok: true };
  }

  try {
    await fs.promises.mkdir(targetMountPoint, { recursive: true });
  } catch {
    // mount may create the directory
  }

  const mountArgsList: string[][] = [
    [targetMountPoint],
    binding.fsType && binding.fsType !== 'auto'
      ? ['-t', binding.fsType, binding.device, targetMountPoint]
      : [binding.device, targetMountPoint],
  ];

  const errors: string[] = [];
  for (const args of mountArgsList) {
    const result = await runPrivilegedMount(args);
    if (result.ok && isMountPointActive(targetMountPoint)) {
      return { ok: true };
    }
    if (!result.ok) errors.push(result.error);
  }

  return { ok: false, error: errors[0] || 'Mount command finished but partition is still unavailable' };
}

type LsblkRow = {
  path: string;
  label: string;
  fstype: string;
  mountpoint: string;
};

type LsblkJsonNode = {
  name?: string;
  path?: string;
  label?: string | null;
  fstype?: string | null;
  mountpoint?: string | null;
  children?: LsblkJsonNode[];
};

function flattenLsblkNodes(nodes: LsblkJsonNode[] | undefined, out: LsblkRow[] = []): LsblkRow[] {
  if (!nodes) return out;
  for (const node of nodes) {
    const devicePath = String(node.path || (node.name ? `/dev/${node.name}` : '')).trim();
    const fstype = String(node.fstype || '').trim();
    const label = String(node.label || '').trim();
    const mountpoint = String(node.mountpoint || '').trim();
    if (devicePath.startsWith('/dev/') && !SKIP_FS_TYPES.has(fstype.toLowerCase())) {
      out.push({
        path: devicePath,
        label,
        fstype,
        mountpoint,
      });
    }
    flattenLsblkNodes(node.children, out);
  }
  return out;
}

async function readLsblkRows(): Promise<LsblkRow[]> {
  if (!LINUX) return [];
  try {
    const { stdout } = await execFileAsync(
      'lsblk',
      ['-J', '-o', 'NAME,PATH,LABEL,FSTYPE,MOUNTPOINT'],
      { timeout: 10_000 },
    );
    const parsed = JSON.parse(stdout) as { blockdevices?: LsblkJsonNode[] };
    return flattenLsblkNodes(parsed.blockdevices);
  } catch {
    return [];
  }
}

function normalizeVolumeLabel(label: string): string {
  return String(label || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();
}

function labelsMatch(expected: string, actual: string): boolean {
  const a = normalizeVolumeLabel(expected);
  const b = normalizeVolumeLabel(actual);
  if (!a || !b) return false;
  if (a === b) return true;
  return a.includes(b) || b.includes(a);
}

async function findDevicePathsForLabel(label: string): Promise<string[]> {
  const wanted = String(label || '').trim();
  if (!wanted) return [];

  const found = new Set<string>();

  try {
    const { stdout } = await execFileAsync('blkid', ['-L', wanted], { timeout: 10_000 });
    const device = String(stdout || '').split(':')[0]?.trim();
    if (device.startsWith('/dev/')) found.add(device);
  } catch {
    // blkid exits non-zero when label is missing
  }

  try {
    const byLabelDir = '/dev/disk/by-label';
    for (const entry of fs.readdirSync(byLabelDir)) {
      if (!labelsMatch(wanted, entry)) continue;
      const resolved = fs.realpathSync(path.join(byLabelDir, entry));
      if (resolved.startsWith('/dev/')) found.add(resolved);
    }
  } catch {
    // ignore
  }

  const rows = await readLsblkRows();
  for (const row of rows) {
    if (!row.label || row.mountpoint) continue;
    if (labelsMatch(wanted, row.label)) found.add(row.path);
  }

  return [...found];
}

function isPermissionError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('permission denied') ||
    lower.includes('not permitted') ||
    lower.includes('authentication') ||
    lower.includes('only root') ||
    lower.includes('operation not permitted')
  );
}

async function runPrivilegedMount(
  args: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await execFileAsync('mount', args, { timeout: 120_000 });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!isPermissionError(msg)) {
      return { ok: false, error: msg || 'Mount failed' };
    }
    try {
      await execFileAsync('pkexec', ['mount', ...args], {
        timeout: 120_000,
        env: { ...process.env },
      });
      return { ok: true };
    } catch (pkErr) {
      const pkMsg = pkErr instanceof Error ? pkErr.message : String(pkErr);
      if (pkMsg.toLowerCase().includes('dismissed') || pkMsg.toLowerCase().includes('canceled')) {
        return { ok: false, error: 'Mount cancelled in system authentication dialog' };
      }
      return { ok: false, error: pkMsg || msg || 'Mount failed — system password required' };
    }
  }
}

async function runUdisksMount(devicePath: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await execFileAsync('udisksctl', ['mount', '-b', devicePath], {
      timeout: 120_000,
      env: { ...process.env },
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes('not authorized') || isPermissionError(msg)) {
      try {
        await execFileAsync('pkexec', ['udisksctl', 'mount', '-b', devicePath], {
          timeout: 120_000,
          env: { ...process.env },
        });
        return { ok: true };
      } catch (pkErr) {
        const pkMsg = pkErr instanceof Error ? pkErr.message : String(pkErr);
        if (pkMsg.toLowerCase().includes('dismissed') || pkMsg.toLowerCase().includes('canceled')) {
          return { ok: false, error: 'Mount cancelled in system authentication dialog' };
        }
        return { ok: false, error: pkMsg || msg || 'Mount failed — system password required' };
      }
    }
    return { ok: false, error: msg || 'udisksctl mount failed' };
  }
}

function mediaVolumeLabelFromPath(folderPath: string): string | null {
  const parts = normalizeMountPath(folderPath).split(path.sep).filter(Boolean);
  const mediaIdx = parts.indexOf('media');
  if (mediaIdx >= 0 && parts.length > mediaIdx + 2) {
    return parts[mediaIdx + 2] ?? null;
  }
  const runIdx = parts.indexOf('run');
  if (runIdx >= 0 && parts[runIdx + 1] === 'media' && parts.length > runIdx + 3) {
    return parts[runIdx + 3] ?? null;
  }
  return null;
}

async function tryUdisksMountForPath(
  folderPath: string,
): Promise<{ ok: true; mountPoint: string } | { ok: false; error: string }> {
  const label = mediaVolumeLabelFromPath(folderPath);
  if (!label) {
    return { ok: false, error: 'No removable volume label found in folder path' };
  }

  const devices = await findDevicePathsForLabel(label);
  if (!devices.length) {
    return {
      ok: false,
      error: `No block device found for label "${label}". Check that the drive is connected.`,
    };
  }

  const errors: string[] = [];
  for (const devicePath of devices) {
    const result = await runUdisksMount(devicePath);
    if (!result.ok) {
      errors.push(result.error);
      continue;
    }
    if (await canAccessDirectory(folderPath)) {
      const mounted = [...readMountedPoints()].find((mp) =>
        normalizeMountPath(folderPath).startsWith(`${mp}${path.sep}`),
      );
      return {
        ok: true,
        mountPoint: mounted || normalizeMountPath(path.dirname(folderPath)),
      };
    }
    errors.push(`Mounted ${devicePath} but folder is still inaccessible`);
  }

  return { ok: false, error: errors[0] || `Failed to mount volume "${label}"` };
}

export async function tryMountUnixPartition(
  mountPoint: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!LINUX) {
    return { ok: false, error: 'Partition mounting is only supported on Linux' };
  }

  const targetMountPoint = normalizeMountPath(mountPoint);
  if (!targetMountPoint) {
    return { ok: false, error: 'Invalid mount point' };
  }

  const binding = loadMountBindings().find(
    (item) => normalizeMountPath(item.mountPoint) === targetMountPoint,
  );
  if (!binding) {
    return { ok: false, error: 'No mount configuration found for this path' };
  }

  return applyMountBinding(binding);
}

export async function tryMountForFolder(
  folderPath: string,
): Promise<{ ok: true; mountPoint: string } | { ok: false; error: string }> {
  if (!LINUX) {
    return { ok: false, error: 'Partition mounting is only supported on Linux' };
  }

  const resolved = normalizeMountPath(folderPath);
  if (!resolved) {
    return { ok: false, error: 'Invalid folder path' };
  }

  if (await canAccessDirectory(resolved)) {
    return { ok: true, mountPoint: resolved };
  }

  const errors: string[] = [];

  if (mediaVolumeLabelFromPath(resolved)) {
    const udisksFirst = await tryUdisksMountForPath(resolved);
    if (udisksFirst.ok && (await canAccessDirectory(resolved))) {
      return udisksFirst;
    }
    if (!udisksFirst.ok) errors.push(udisksFirst.error);
  }

  const candidates = resolveMountCandidatesForPath(resolved);

  for (const binding of candidates) {
    const result = await applyMountBinding(binding);
    if (result.ok && (await canAccessDirectory(resolved))) {
      return { ok: true, mountPoint: normalizeMountPath(binding.mountPoint) };
    }
    if (!result.ok) errors.push(result.error);
  }

  if (!mediaVolumeLabelFromPath(resolved)) {
    const udisks = await tryUdisksMountForPath(resolved);
    if (udisks.ok && (await canAccessDirectory(resolved))) {
      return udisks;
    }
    if (!udisks.ok) errors.push(udisks.error);
  }

  return {
    ok: false,
    error: errors[0] || 'Mount failed — add an entry to /etc/fstab or co21 settings unixPartitionMounts',
  };
}

export function registerUnixPartitionMountIpc(ipcMain: IpcMain): void {
  ipcMain.handle('media:folder-access', async (_evt, payload: { folderPath?: string }) => {
    try {
      const folderPath = String(payload?.folderPath || '').trim();
      if (!folderPath) return { ok: false, error: 'No folder path' };
      const result = await assessMediaFolderAccess(folderPath);
      if (result.accessible) {
        return { ok: true, accessible: true };
      }
      return { ok: true, accessible: false, hint: result.hint };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg || 'Failed to inspect folder access' };
    }
  });

  ipcMain.handle(
    'media:try-mount-partition',
    async (_evt, payload: { mountPoint?: string; folderPath?: string }) => {
      try {
        const folderPath = String(payload?.folderPath || '').trim();
        const mountPoint = String(payload?.mountPoint || '').trim();

        if (folderPath) {
          const result = await tryMountForFolder(folderPath);
          if (!result.ok) return result;
          return { ok: true, mountPoint: result.mountPoint };
        }

        if (!mountPoint) return { ok: false, error: 'No mount point or folder path' };
        const result = await tryMountUnixPartition(mountPoint);
        if (!result.ok) return result;
        return { ok: true, mountPoint: normalizeMountPath(mountPoint) };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, error: msg || 'Mount failed' };
      }
    },
  );
}

/** Settings file path helper for docs / future UI. */
export function co21UnixPartitionSettingsFile(): string {
  return path.join(resolveActiveDataPath(), ...APP_DATA_PATH_SEGMENTS.co21SettingsFile);
}
