import logger from 'src/utils/logger';

const GENERIC_HOST_LABELS = new Set([
  'localhost',
  'localdomain',
  'workgroup',
  'android',
  'iphone',
  'ipad',
  'unknown',
  'device',
  'computer',
  'user-pc',
  'users-pc',
]);

/** Normalize OS / router hostname for use as CO21 device label. */
export function sanitizeHostDeviceLabel(raw: string | undefined | null): string {
  if (!raw) return '';
  let s = String(raw).trim();
  if (!s) return '';

  const dot = s.indexOf('.');
  if (dot > 0) s = s.slice(0, dot);

  s = s.replace(/[^\p{L}\p{N}\s._-]+/gu, '').trim();
  if (!s) return '';

  const lower = s.toLowerCase();
  if (GENERIC_HOST_LABELS.has(lower)) return '';
  if (/^[0-9a-f]{8,}$/i.test(s.replace(/-/g, ''))) return '';

  return s.length > 64 ? s.slice(0, 64) : s;
}

type ElectronHostLabelApi = {
  getHostDeviceLabel?: () => Promise<string>;
};

/**
 * Best-effort label from the OS (PC name on Windows, hostname on macOS/Linux).
 * Matches what many routers show in the connected-devices list.
 */
export async function getSuggestedHostDeviceLabel(): Promise<string> {
  const api = (window as unknown as { electronAPI?: ElectronHostLabelApi }).electronAPI;
  if (api?.getHostDeviceLabel) {
    try {
      const fromOs = await api.getHostDeviceLabel();
      const label = sanitizeHostDeviceLabel(fromOs);
      if (label) return label;
    } catch (e) {
      logger.warn('[hostDeviceLabel] Electron getHostDeviceLabel failed', e);
    }
  }
  return '';
}
