import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import {
  getSetting,
  setSetting,
} from 'src/modules/storage/backend/electron/electronBackend';
import type { Controllable } from 'src/types/Controllable';
import type {
  UserProfile,
  Co21Account,
  GoogleAccountLink,
  GoogleFeature,
  CalendarSyncSettings,
} from './models/UserAccount';
import { createDefaultProfile, DEFAULT_CALENDAR_SYNC } from './models/UserAccount';
import logger from 'src/utils/logger';

const STORAGE_KEY = 'co21_user_profile';

class UserController implements Controllable {
  readonly controllerName = 'user' as const;

  readonly profile = ref<UserProfile | null>(null);
  readonly isLoaded = ref(false);

  readonly co21Account = computed(() => this.profile.value?.co21 ?? null);
  readonly googleAccount = computed(() => this.profile.value?.google ?? null);

  readonly hasCo21Password = computed(
    () => !!this.profile.value?.co21?.passwordHash,
  );

  readonly isGoogleConnected = computed(() => !!this.profile.value?.google);

  readonly identifier = computed(() => {
    const co21 = this.profile.value?.co21;
    if (!co21) return null;
    return co21.identifier;
  });

  readonly identifierType = computed(
    () => this.profile.value?.co21?.identifierType ?? 'deviceId',
  );

  readonly googleFeatures = computed<GoogleFeature[]>(
    () => this.profile.value?.google?.enabledFeatures ?? [],
  );

  readonly isGoogleAuthEnabled = computed(() =>
    this.googleFeatures.value.includes('auth'),
  );

  readonly isGoogleCalendarEnabled = computed(() =>
    this.googleFeatures.value.includes('calendar'),
  );

  readonly isGoogleDriveEnabled = computed(() =>
    this.googleFeatures.value.includes('drive'),
  );

  // ── Persistence ──────────────────────────────────────────────────────────

  readonly load = async (): Promise<UserProfile> => {
    try {
      const raw = await getSetting(STORAGE_KEY, null);
      if (raw && typeof raw === 'object' && raw.co21) {
        this.profile.value = raw as UserProfile;
      } else {
        const deviceId = await this.resolveDeviceId();
        this.profile.value = createDefaultProfile(deviceId);
        await this.save();
      }
    } catch (e) {
      logger.warn('[UserController] load failed, creating default', e);
      const deviceId = await this.resolveDeviceId();
      this.profile.value = createDefaultProfile(deviceId);
    }
    this.isLoaded.value = true;
    return this.profile.value;
  };

  readonly save = async (): Promise<void> => {
    if (!this.profile.value) return;
    await setSetting(STORAGE_KEY, JSON.parse(JSON.stringify(this.profile.value)));
  };

  // ── CO21 Account ─────────────────────────────────────────────────────────

  readonly setEmail = async (email: string): Promise<void> => {
    if (!this.profile.value) return;
    this.profile.value.co21.identifier = email;
    this.profile.value.co21.identifierType = 'email';
    await this.save();
  };

  readonly setPassword = async (hash: string): Promise<void> => {
    if (!this.profile.value) return;
    this.profile.value.co21.passwordHash = hash;
    await this.save();
  };

  readonly removePassword = async (): Promise<void> => {
    if (!this.profile.value) return;
    this.profile.value.co21.passwordHash = null;
    await this.save();
  };

  // ── Google Account ───────────────────────────────────────────────────────

  readonly connectGoogle = async (
    link: Omit<GoogleAccountLink, 'connectedAt'>,
  ): Promise<void> => {
    if (!this.profile.value) return;
    this.profile.value.google = {
      ...link,
      connectedAt: new Date().toISOString(),
    };
    await this.save();
  };

  readonly disconnectGoogle = async (): Promise<void> => {
    if (!this.profile.value) return;
    this.profile.value.google = null;
    await this.save();
  };

  readonly toggleGoogleFeature = async (
    feature: GoogleFeature,
    enabled: boolean,
  ): Promise<void> => {
    if (!this.profile.value?.google) return;
    const features = new Set(this.profile.value.google.enabledFeatures);
    if (enabled) features.add(feature);
    else features.delete(feature);
    this.profile.value.google.enabledFeatures = [...features];
    await this.save();
  };

  readonly calendarGroupId = computed(
    () => this.profile.value?.google?.calendarGroupId ?? null,
  );

  readonly setCalendarGroup = async (groupId: string | null): Promise<void> => {
    if (!this.profile.value?.google) return;
    this.profile.value.google.calendarGroupId = groupId;
    await this.save();
  };

  // ── Calendar Sync ────────────────────────────────────────────────────────

  readonly calendarSync = computed<CalendarSyncSettings>(
    () => this.profile.value?.google?.calendarSync ?? { ...DEFAULT_CALENDAR_SYNC },
  );

  readonly isCalendarSyncConfirmed = computed(
    () => this.profile.value?.google?.calendarSync?.confirmed ?? false,
  );

  readonly isCalendarSyncReady = computed(() => {
    const g = this.profile.value?.google;
    if (!g) return false;
    return (
      g.enabledFeatures.includes('calendar') &&
      !!g.calendarGroupId &&
      g.calendarSync.confirmed
    );
  });

  readonly setCalendarSyncInterval = async (hours: number): Promise<void> => {
    if (!this.profile.value?.google) return;
    this.ensureCalendarSync();
    this.profile.value.google.calendarSync.intervalHours = Math.max(1, hours);
    this.profile.value.google.calendarSync.confirmed = false;
    await this.save();
  };

  readonly confirmCalendarSync = async (): Promise<void> => {
    if (!this.profile.value?.google) return;
    this.ensureCalendarSync();
    this.profile.value.google.calendarSync.confirmed = true;
    await this.save();
  };

  readonly revokeCalendarSync = async (): Promise<void> => {
    if (!this.profile.value?.google) return;
    this.ensureCalendarSync();
    this.profile.value.google.calendarSync.confirmed = false;
    await this.save();
  };

  readonly updateCalendarSyncMeta = async (
    lastSyncAt: string,
    lastSyncRange: string,
  ): Promise<void> => {
    if (!this.profile.value?.google) return;
    this.ensureCalendarSync();
    this.profile.value.google.calendarSync.lastSyncAt = lastSyncAt;
    this.profile.value.google.calendarSync.lastSyncRange = lastSyncRange;
    await this.save();
  };

  private ensureCalendarSync(): void {
    if (!this.profile.value?.google) return;
    if (!this.profile.value.google.calendarSync) {
      this.profile.value.google.calendarSync = { ...DEFAULT_CALENDAR_SYNC };
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private readonly resolveDeviceId = async (): Promise<string> => {
    try {
      const existing = await getSetting('co21_device_id', null);
      if (existing) return String(existing);
    } catch {
      void 0;
    }
    const id = crypto.randomUUID?.() ?? `dev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      await setSetting('co21_device_id', id);
    } catch {
      void 0;
    }
    return id;
  };
}

export const UserStoreController = defineStore('user', () => new UserController());
export type UserControllerInstance = ReturnType<typeof UserStoreController>;
