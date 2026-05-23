import { Capacitor } from '@capacitor/core';
import {
  CO21_LAN_API_PREFIX,
  CO21_LAN_PAIRING_PORT,
  co21LanBaseUrl,
} from './lanPairingConstants';
import { getCo21LanApi } from './co21LanRuntime';
import { lanFetchInfo } from './lanPairingClient';
import { isLanDebugCaptureActive, lanDebugNote } from './lanDebugLog';
import {
  listCandidateHostsForDevice,
  prepareRemotesForLanOps,
} from './lanRemoteHost';
import {
  loadConnectedDevices,
  loadOwnDeviceMeta,
  mergeLocalDeviceIntoList,
} from 'src/modules/storage/sync/deviceRoleAssignment';

const ROUTER_PC_HINTS = [
  'Phone browser test (full path): http://<PC-LAN-IP>:47321/co21-lan/v1/info',
  'If you only open http://<IP>:47321 you get {"error":"not_found"} — that still proves TCP works.',
  'Browser works but app failed: WebView blocks http:// LAN from https://localhost — app now uses native CapacitorHttp.',
  'Success looks like: {"deviceId":"...","deviceName":"...","appVersion":"..."}',
  'Windows: CO21 desktop app open; network profile Private; allow inbound TCP port 47321.',
  'Router: try disabling SPI firewall briefly; turn off Wi‑Fi AP / client isolation.',
  'Same LAN: phone and PC on same 192.168.x.x subnet (not guest Wi‑Fi).',
  'PC IP: use ipconfig Ethernet/Wi‑Fi IPv4 — not VPN (10.x) or link-local (169.254.x.x).',
  'PC→phone works but phone→PC fails: usually PC inbound blocked or wrong PC IP stored on phone.',
].join('\n');

async function probeInfoLabel(host: string, timeoutMs: number): Promise<string> {
  const base = co21LanBaseUrl(host);
  if (!base) return 'invalid host';
  const url = `${base}${CO21_LAN_API_PREFIX}/info`;
  try {
    const info = await lanFetchInfo(base, { timeoutMs });
    if (info?.deviceId) {
      return `OK · ${info.deviceName} (${info.deviceId}) · ${url}`;
    }
    return `reachable but empty /info · ${url}`;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return `FAIL · ${msg} · ${url}`;
  }
}

/** Log local IPs, peer candidates, and probe results into the debug LAN log. */
export async function runLanNetworkDiagnose(): Promise<void> {
  if (!isLanDebugCaptureActive()) return;

  lanDebugNote('Network diagnose', `Started · platform=${Capacitor.getPlatform()}`);

  const api = getCo21LanApi();
  try {
    const st = await api?.status?.();
    const addrs = (st?.addresses ?? []).map(String).filter(Boolean);
    lanDebugNote(
      'This device (listener)',
      [
        `listening=${st?.listening ? 'yes' : 'no'}`,
        `port=${CO21_LAN_PAIRING_PORT}`,
        `IPs=${addrs.length ? addrs.join(', ') : '(none detected)'}`,
      ].join('\n'),
    );
    for (const ip of addrs.slice(0, 6)) {
      lanDebugNote(`Self-probe ${ip}`, await probeInfoLabel(ip, 3000));
    }
  } catch (e: unknown) {
    lanDebugNote('This device status', e instanceof Error ? e.message : String(e));
  }

  const local = await loadOwnDeviceMeta();
  const all = mergeLocalDeviceIntoList(await loadConnectedDevices(), local);
  const remotes = await prepareRemotesForLanOps({ persistHosts: false, devices: all });

  if (!remotes.length) {
    lanDebugNote('Remote peers', 'No paired devices with a LAN host — pair or set IP in Connections.');
  }

  for (const d of remotes) {
    const hosts = await listCandidateHostsForDevice(d);
    lanDebugNote(
      `Peer: ${d.name}`,
      [
        `deviceId=${d.id}`,
        `stored host=${(d.lanHost || '').trim() || '(none)'}`,
        `try order: ${hosts.length ? hosts.join(' → ') : '(no candidates)'}`,
      ].join('\n'),
    );
    for (const host of hosts) {
      lanDebugNote(`Probe ${d.name} @ ${host}`, await probeInfoLabel(host, 6000));
    }
  }

  lanDebugNote('If status is 0 / NETWORK', ROUTER_PC_HINTS);
}
