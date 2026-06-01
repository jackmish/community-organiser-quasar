export const OPEN_INFOSCREEN_SETTINGS_EVENT = 'co21:open-infoscreen-settings';

/** Scroll organiser to default calendar view (42-day, today). */
export const INFOSCREEN_RESET_CALENDAR_VIEW_EVENT = 'co21:infoscreen-reset-calendar-view';

/** Show the full-screen clock immediately (preview / test). */
export const INFOSCREEN_TEST_CLOCK_EVENT = 'co21:infoscreen-test-clock';

/** Dismiss the full-screen clock (tap / click). */
export const INFOSCREEN_DISMISS_SPLASH_EVENT = 'co21:infoscreen-dismiss-splash';

export function dispatchOpenInfoscreenSettings(): void {
  window.dispatchEvent(new Event(OPEN_INFOSCREEN_SETTINGS_EVENT));
}

export function dispatchInfoscreenResetCalendarView(): void {
  window.dispatchEvent(new Event(INFOSCREEN_RESET_CALENDAR_VIEW_EVENT));
}

export function dispatchInfoscreenTestClock(): void {
  window.dispatchEvent(new Event(INFOSCREEN_TEST_CLOCK_EVENT));
}

export function dispatchInfoscreenDismissSplash(): void {
  window.dispatchEvent(new Event(INFOSCREEN_DISMISS_SPLASH_EVENT));
}
