import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  APP_HEADER_CONCEAL_REASON,
  appHeaderConceal,
} from 'src/composables/useAppHeaderConceal';

describe('appHeaderConceal', () => {
  beforeEach(() => {
    appHeaderConceal.releaseAll();
    document.documentElement.classList.remove('co21-app-header-concealed', 'co21-schedule-mode');
  });

  afterEach(() => {
    appHeaderConceal.releaseAll();
    document.documentElement.classList.remove('co21-app-header-concealed', 'co21-schedule-mode');
  });

  it('conceals while any reason is active', () => {
    expect(appHeaderConceal.concealed.value).toBe(false);
    appHeaderConceal.request(APP_HEADER_CONCEAL_REASON.TODO_SCHEDULE);
    expect(appHeaderConceal.concealed.value).toBe(true);
    appHeaderConceal.request(APP_HEADER_CONCEAL_REASON.MOBILE_CALENDAR_DAY_INDICATORS);
    appHeaderConceal.release(APP_HEADER_CONCEAL_REASON.TODO_SCHEDULE);
    expect(appHeaderConceal.concealed.value).toBe(true);
    appHeaderConceal.release(APP_HEADER_CONCEAL_REASON.MOBILE_CALENDAR_DAY_INDICATORS);
    expect(appHeaderConceal.concealed.value).toBe(false);
  });

  it('toggles document classes for concealed and schedule mode', () => {
    appHeaderConceal.syncReason(APP_HEADER_CONCEAL_REASON.TODO_SCHEDULE, true);
    expect(document.documentElement.classList.contains('co21-app-header-concealed')).toBe(true);
    expect(document.documentElement.classList.contains('co21-schedule-mode')).toBe(true);

    appHeaderConceal.syncReason(APP_HEADER_CONCEAL_REASON.TODO_SCHEDULE, false);
    appHeaderConceal.syncReason(APP_HEADER_CONCEAL_REASON.MOBILE_CALENDAR_DAY_INDICATORS, true);
    expect(document.documentElement.classList.contains('co21-schedule-mode')).toBe(false);
    expect(document.documentElement.classList.contains('co21-app-header-concealed')).toBe(true);
  });
});
