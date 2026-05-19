/**
 * Shape returned when browsing for CO21 desktops on the LAN (mDNS).
 * Renderer receives this from `electronLan.browseCo21` IPC.
 */
export type Co21DiscoveredHost = {
  displayName: string;
  /** Use with {@link co21LanBaseUrl}: IPv4 if known, else Bonjour host (often `*.local`). */
  connectHost: string;
  port: number;
  fqdn: string;
  deviceId?: string;
  appVersion?: string;
};
