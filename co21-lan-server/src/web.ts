import type { Co21LanServerPlugin, LanIdentity, LanTrustedPeer } from './definitions';

export class Co21LanServerWeb implements Co21LanServerPlugin {
  async startServer(_options: LanIdentity): Promise<{ ok: boolean; error?: string }> {
    return { ok: false, error: 'not_native' };
  }

  async stopServer(): Promise<{ ok: boolean }> {
    return { ok: true };
  }

  async status(): Promise<{ listening: boolean; port: number; addresses: string[] }> {
    return { listening: false, port: 47321, addresses: [] };
  }

  async setTrustedContractDevices(_options: {
    peers: LanTrustedPeer[];
  }): Promise<{ ok: boolean; count: number }> {
    return { ok: true, count: 0 };
  }

  async resolvePair(_options: { token: string; accept: boolean }): Promise<{ ok: boolean }> {
    return { ok: false };
  }

  async resolveSyncExchange(_options: {
    requestId: string;
    responseJson: string;
  }): Promise<{ ok: boolean }> {
    return { ok: false };
  }

  async addListener(): Promise<{ remove: () => void }> {
    return { remove: () => void 0 };
  }
}
