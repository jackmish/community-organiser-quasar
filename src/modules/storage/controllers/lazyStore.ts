export function lazyStore<T extends object>(fn: () => T): T {
  const overrides: Record<string | symbol, any> = {};

  return new Proxy<T>({} as T, {
    get(_, prop: string | symbol) {
      if (prop in overrides) return overrides[prop];
      try {
        const real = fn() as any;
        return real ? real[prop] : undefined;
      } catch (e) {
        return undefined;
      }
    },

    set(_, prop: string | symbol, value: any) {
      overrides[prop] = value;
      return true;
    },

    getOwnPropertyDescriptor(_, prop: string | symbol) {
      if (prop in overrides) {
        return {
          configurable: true,
          enumerable: true,
          writable: true,
          value: overrides[prop],
        } as PropertyDescriptor;
      }
      try {
        const real = fn() as any;
        if (real && prop in real) {
          return (
            Object.getOwnPropertyDescriptor(real, prop) || {
              configurable: true,
              enumerable: true,
              writable: true,
              value: real[prop],
            }
          );
        }
      } catch (e) {
        void e;
      }
      // If the real store doesn't expose the property yet, create a noop
      // placeholder so test frameworks (vi.spyOn) can replace/spy it.
      const placeholder = function () {
        // noop placeholder
      };
      overrides[prop] = placeholder;
      return {
        configurable: true,
        enumerable: true,
        writable: true,
        value: placeholder,
      } as PropertyDescriptor;
    },

    defineProperty(_, prop: string | symbol, descriptor: PropertyDescriptor) {
      try {
        if ('value' in descriptor) overrides[prop] = descriptor.value;
        return true;
      } catch (e) {
        return false;
      }
    },

    ownKeys() {
      try {
        const real = fn() as any;
        const realKeys = real ? Reflect.ownKeys(real) : [];
        const overKeys = Reflect.ownKeys(overrides);
        return Array.from(new Set([...realKeys, ...overKeys]));
      } catch (e) {
        return Reflect.ownKeys(overrides);
      }
    },
  });
}

export default lazyStore;
