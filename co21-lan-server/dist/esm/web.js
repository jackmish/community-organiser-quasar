export class Co21LanServerWeb {
    async startServer(_options) {
        return { ok: false, error: 'not_native' };
    }
    async stopServer() {
        return { ok: true };
    }
    async status() {
        return { listening: false, port: 47321, addresses: [] };
    }
    async setTrustedContractDevices(_options) {
        return { ok: true, count: 0 };
    }
    async resolvePair(_options) {
        return { ok: false };
    }
    async resolveSyncExchange(_options) {
        return { ok: false };
    }
    async addListener() {
        return { remove: () => void 0 };
    }
}
