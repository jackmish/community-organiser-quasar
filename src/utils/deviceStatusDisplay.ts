/** Row shown in task header / options menu device strip. */
export type DeviceStatusRow = {
  id: string;
  name: string;
  shortLine1: string;
  shortLine2: string;
  /** Connection transport icon (LAN/Wi‑Fi for now). */
  linkIcon: string;
  connected: boolean;
};

function takePartChars(part: string, max = 3): string {
  const alnum = part.replace(/[^a-zA-Z0-9]/g, '');
  if (!alnum) return '';
  return alnum.slice(0, max);
}

/** e.g. "Nord Android" → Nor / And */
export function deviceShortcutLines(
  name: string,
  id: string,
): { shortLine1: string; shortLine2: string } {
  const base = String(name || id || '').trim();
  if (!base) return { shortLine1: '--', shortLine2: '' };
  const parts = base.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (parts.length >= 2) {
    const shortLine1 = takePartChars(parts[0]!, 3);
    const shortLine2 = takePartChars(parts[1]!, 3);
    return {
      shortLine1: shortLine1 || '--',
      shortLine2,
    };
  }
  const single = takePartChars(parts[0] || base, 6);
  if (single.length <= 3) return { shortLine1: single || '--', shortLine2: '' };
  return { shortLine1: single.slice(0, 3), shortLine2: single.slice(3, 6) };
}

/** LAN pairing uses Wi‑Fi/router path for now. */
export function deviceLinkIcon(connected: boolean): string {
  return connected ? 'wifi' : 'wifi_off';
}

export function buildDeviceStatusRow(
  device: { id: string; name?: string },
  connected: boolean,
): DeviceStatusRow {
  const name = String(device.name || device.id || '');
  const { shortLine1, shortLine2 } = deviceShortcutLines(name, device.id);
  return {
    id: String(device.id),
    name,
    shortLine1,
    shortLine2,
    linkIcon: deviceLinkIcon(connected),
    connected,
  };
}
