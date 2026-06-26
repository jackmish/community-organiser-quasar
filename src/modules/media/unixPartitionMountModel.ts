/** Fstab / settings binding for a Unix mount point. */
export type UnixPartitionMountBinding = {
  mountPoint: string;
  device: string;
  fsType: string;
  options: string[];
  label: string;
};

export type MediaFolderMountReason = 'not_mounted' | 'permission_denied' | 'missing_binding';

/** Shown when a task folder lives on an unmounted or inaccessible partition. */
export type MediaFolderMountHint = {
  forbidden: true;
  canTryMount: boolean;
  mountPoint: string;
  mountLabel: string;
  reason: MediaFolderMountReason;
  /** Task folder path — used when mount must be inferred from fstab/udisks. */
  folderPath?: string;
};

export type MediaFolderAccessResult =
  | { ok: true; accessible: true }
  | { ok: true; accessible: false; hint: MediaFolderMountHint }
  | { ok: false; error: string };

export type TryUnixPartitionMountResult =
  | { ok: true; mountPoint: string }
  | { ok: false; error: string };

export const CO21_UNIX_PARTITION_MOUNTS_KEY = 'unixPartitionMounts';

export type Co21UnixPartitionMountEntry = {
  mountPoint: string;
  device: string;
  fsType?: string;
  label?: string;
};
