import type { Co21LanServerPlugin, LanIdentity, LanTrustedPeer } from './definitions';
export declare class Co21LanServerWeb implements Co21LanServerPlugin {
    startServer(_options: LanIdentity): Promise<{
        ok: boolean;
        error?: string;
    }>;
    stopServer(): Promise<{
        ok: boolean;
    }>;
    status(): Promise<{
        listening: boolean;
        port: number;
        addresses: string[];
    }>;
    setTrustedContractDevices(_options: {
        peers: LanTrustedPeer[];
    }): Promise<{
        ok: boolean;
        count: number;
    }>;
    resolvePair(_options: {
        token: string;
        accept: boolean;
    }): Promise<{
        ok: boolean;
    }>;
    resolveSyncExchange(_options: {
        requestId: string;
        responseJson: string;
    }): Promise<{
        ok: boolean;
    }>;
    addListener(): Promise<{
        remove: () => void;
    }>;
}
