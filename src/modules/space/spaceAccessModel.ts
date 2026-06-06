export type SpaceAccessMethod = 'password';

/** On-disk `{space}/co21/access/device-space-access.json` — per device, not LAN-synced. */
export interface SpaceAccessFile {
  enabled: boolean;
  method: SpaceAccessMethod;
  passwordHash: string | null;
  updatedAt: string;
}

export interface SpaceAccessStatus {
  enabled: boolean;
  hasPassword: boolean;
  method: SpaceAccessMethod | null;
  spaceName: string;
}
