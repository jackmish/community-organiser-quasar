export type LanIdentity = {
    deviceId: string;
    deviceName: string;
    appVersion: string;
};
export type LanTrustedPeer = {
    deviceId: string;
    lanHost?: string;
};
export type Co21LanServerPlugin = {
    startServer(options: LanIdentity): Promise<{
        ok: boolean;
        port?: number;
        addresses?: string[];
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
    setTrustedContractDevices(options: {
        peers: LanTrustedPeer[];
    }): Promise<{
        ok: boolean;
        count: number;
    }>;
    resolvePair(options: {
        token: string;
        accept: boolean;
    }): Promise<{
        ok: boolean;
    }>;
    resolveSyncExchange(options: {
        requestId: string;
        responseJson: string;
    }): Promise<{
        ok: boolean;
    }>;
    addListener(eventName: 'pairingPending' | 'pairingComplete' | 'syncContractIncoming' | 'syncContractRejected' | 'syncExchangeRequest', listenerFunc: (event: {
        requestId?: string;
        body?: string;
        [key: string]: unknown;
    }) => void): Promise<{
        remove: () => void;
    }>;
};
