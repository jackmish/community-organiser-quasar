const services: Record<string, any> = {};

export function registerAppService(name: string, svc: any) {
  services[name] = svc;
}

export function getAppService<T = any>(name: string): T | null {
  return (services[name] ?? null) as T | null;
}

export function app(name: string) {
  try {
    const svc = getAppService(name);
    if (!svc) return null;

    return new Proxy(svc, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (typeof value === 'function') {
          return async (...args: any[]) => {
            try {
              return await value.apply(target, args);
            } catch (err) {
              console.error(`app(${name}) ${String(prop)} threw`, err);
              return undefined;
            }
          };
        }
        return value;
      },
    });
  } catch (err) {
    console.error('app() lookup failed', err);
    return null;
  }
}

export default { registerAppService, getAppService, app };
