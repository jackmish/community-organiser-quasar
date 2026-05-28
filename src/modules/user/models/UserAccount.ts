export interface Co21Account {
  /** Primary identifier — either email or device-generated id */
  identifier: string;
  identifierType: 'email' | 'deviceId';
  /** Optional password hash; null when not set (default) */
  passwordHash: string | null;
  createdAt: string;
}

export type GoogleFeature = 'auth' | 'calendar' | 'drive';

export interface CalendarSyncSettings {
  /** Sync interval in hours */
  intervalHours: number;
  /** User confirmed settings — sync is only active when true */
  confirmed: boolean;
  /** ISO timestamp of last successful sync */
  lastSyncAt: string | null;
  /** ISO date range of last synced window (e.g. "2026-05-01/2026-06-15") */
  lastSyncRange: string | null;
}

export const DEFAULT_CALENDAR_SYNC: CalendarSyncSettings = {
  intervalHours: 12,
  confirmed: false,
  lastSyncAt: null,
  lastSyncRange: null,
};

export interface GoogleAccountLink {
  /** Google email address */
  email: string;
  displayName: string;
  avatarUrl: string | null;
  connectedAt: string;
  /** Which features are enabled */
  enabledFeatures: GoogleFeature[];
  /** Group ID where calendar events are stored */
  calendarGroupId: string | null;
  /** Calendar sync configuration */
  calendarSync: CalendarSyncSettings;
}

export interface UserProfile {
  co21: Co21Account;
  google: GoogleAccountLink | null;
}

export function createDefaultProfile(deviceId: string): UserProfile {
  return {
    co21: {
      identifier: deviceId,
      identifierType: 'deviceId',
      passwordHash: null,
      createdAt: new Date().toISOString(),
    },
    google: null,
  };
}
