/** True for typical home/office LAN ranges (not VPN/public). */
export function isPrivateLanIPv4(ip: string): boolean {
  const parts = ip.split('.').map((x) => Number(x));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/** Prefer Wi‑Fi/home LAN addresses (192.168.x.x first) over VPN/virtual adapters. */
export function sortLanIPv4Addresses(ips: string[]): string[] {
  const uniq = [...new Set(ips.filter(Boolean))];
  const score = (ip: string): number => {
    if (!isPrivateLanIPv4(ip)) return 100;
    if (ip.startsWith('192.168.')) return 0;
    if (ip.startsWith('10.')) return 10;
    return 20;
  };
  return uniq.sort((a, b) => score(a) - score(b) || a.localeCompare(b));
}

/** Best-effort local IPv4 discovery in the renderer (Capacitor / browser). */
export function probeLocalLanIPv4Addresses(timeoutMs = 2800): Promise<string[]> {
  return new Promise((resolve) => {
    const found = new Set<string>();
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(sortLanIPv4Addresses([...found]));
    };

    const timer = window.setTimeout(finish, timeoutMs);

    try {
      if (typeof RTCPeerConnection === 'undefined') {
        window.clearTimeout(timer);
        finish();
        return;
      }

      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('co21-lan-probe');
      pc.onicecandidate = (ev) => {
        const cand = ev.candidate?.candidate ?? '';
        const m = /(\d{1,3}(?:\.\d{1,3}){3})/.exec(cand);
        if (m?.[1] && isPrivateLanIPv4(m[1])) {
          found.add(m[1]);
        }
      };
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch(() => {
          /* ignore */
        });

      pc.addEventListener('icegatheringstatechange', () => {
        if (pc.iceGatheringState === 'complete') {
          window.clearTimeout(timer);
          pc.close();
          finish();
        }
      });
    } catch {
      window.clearTimeout(timer);
      finish();
    }
  });
}
