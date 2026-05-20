import { Notify } from 'quasar';

export type AppNotifyType = 'positive' | 'negative' | 'info' | 'warning';

/** Toast notification with fallbacks when Quasar Notify is unavailable. */
export function appNotify(
  type: AppNotifyType,
  message: string,
  opts?: { timeout?: number; position?: 'top' | 'bottom' },
): void {
  const payload = {
    type,
    message,
    timeout: opts?.timeout ?? 2500,
    position: opts?.position ?? 'top',
  };
  try {
    if (typeof Notify.create === 'function') {
      Notify.create(payload);
      return;
    }
  } catch {
    void 0;
  }
  try {
    console.warn(`[${type}] ${message}`);
  } catch {
    void 0;
  }
}
