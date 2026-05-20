/**
 * Bonjour / mDNS for CO21 LAN pairing (Electron main process).
 */
import { Bonjour, type Service } from 'bonjour-service';
import logger from 'src/utils/logger';

import {
  CO21_LAN_PAIRING_PORT,
  CO21_MDNS_SERVICE_TYPE,
} from '../src/modules/lan/lanPairingConstants';
import type { Co21DiscoveredHost } from '../src/modules/lan/lanPairingDiscovery';

let bonjourInstance: Bonjour | null = null;
let publishedService: Service | null = null;

function getBonjour(): Bonjour {
  if (!bonjourInstance) {
    bonjourInstance = new Bonjour();
  }
  return bonjourInstance;
}

function sanitizeMdnsServiceName(deviceName: string, deviceId: string): string {
  const tail = deviceId.replace(/-/g, '').slice(-6);
  const base = String(deviceName || 'CO21')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 36);
  const name = (base || 'CO21') + '-' + tail;
  return name.slice(0, 63);
}

function decodeTxt(txt: unknown): Record<string, string> {
  if (!txt || typeof txt !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(txt as Record<string, unknown>)) {
    if (Buffer.isBuffer(v)) out[k] = v.toString('utf8');
    else if (typeof v === 'string') out[k] = v;
    else out[k] = String(v);
  }
  return out;
}

function pickIPv4(addresses: string[] | undefined): string | null {
  if (!addresses?.length) return null;
  for (const a of addresses) {
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(a)) return a;
  }
  return null;
}

function mapService(service: Service): Co21DiscoveredHost {
  const txt = decodeTxt(service.txt);
  const ipv4 = pickIPv4(service.addresses);
  const host = String(service.host || '').replace(/\.$/, '');
  const connectHost = ipv4 || host || '127.0.0.1';
  return {
    displayName: service.name,
    connectHost,
    port: service.port || CO21_LAN_PAIRING_PORT,
    fqdn: service.fqdn || '',
    ...(txt.id ? { deviceId: txt.id } : {}),
    ...(txt.v ? { appVersion: txt.v } : {}),
  };
}

export function startCo21MdnsAdvertise(
  identity: { deviceId: string; deviceName: string; appVersion: string },
  port: number = CO21_LAN_PAIRING_PORT,
): void {
  stopCo21MdnsAdvertise();
  const name = sanitizeMdnsServiceName(identity.deviceName, identity.deviceId);
  try {
    publishedService = getBonjour().publish({
      name,
      type: CO21_MDNS_SERVICE_TYPE,
      port,
      protocol: 'tcp',
      txt: {
        id: identity.deviceId,
        v: identity.appVersion.slice(0, 40),
      },
    });
    logger.info(
      '[lanMdns] advertising',
      name,
      `_${CO21_MDNS_SERVICE_TYPE}._tcp.local`,
      port,
    );
  } catch (e) {
    logger.error('[lanMdns] publish failed', e);
    throw e;
  }
}

export function stopCo21MdnsAdvertise(): void {
  if (publishedService) {
    try {
      if (typeof publishedService.stop === 'function') {
        publishedService.stop();
      }
    } catch (e) {
      logger.warn('[lanMdns] unpublish failed', e);
    }
    publishedService = null;
  }
}

/** Tear down multicast stack (call on app quit after stopping services). */
export function destroyBonjour(): void {
  stopCo21MdnsAdvertise();
  if (bonjourInstance) {
    try {
      bonjourInstance.destroy();
    } catch (e) {
      logger.warn('[lanMdns] destroy failed', e);
    }
    bonjourInstance = null;
  }
}

export async function browseCo21Organisers(options: {
  timeoutMs: number;
  excludeDeviceId?: string;
}): Promise<Co21DiscoveredHost[]> {
  const timeoutMs = Math.max(800, Math.min(options.timeoutMs || 4000, 15_000));
  const exclude = options.excludeDeviceId;

  const bonjour = getBonjour();
  const byKey = new Map<string, Co21DiscoveredHost>();

  return await new Promise((resolve) => {
    const browser = bonjour.find({ type: CO21_MDNS_SERVICE_TYPE, protocol: 'tcp' }, (service: Service) => {
      try {
        const row = mapService(service);
        if (
          exclude &&
          row.deviceId &&
          row.deviceId.trim().toLowerCase() === exclude.trim().toLowerCase()
        ) {
          return;
        }
        const key = row.fqdn || `${row.displayName}@${row.connectHost}`;
        byKey.set(key, row);
      } catch (e) {
        logger.warn('[lanMdns] browse map failed', e);
      }
    });

    setTimeout(() => {
      try {
        browser.stop();
      } catch (e) {
        logger.warn('[lanMdns] browser.stop failed', e);
      }
      resolve([...byKey.values()]);
    }, timeoutMs);
  });
}
