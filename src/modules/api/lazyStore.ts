// Small helper to present a Pinia store as a plain namespace-like object.
// Kept tiny and isolated so tests and other modules can import it directly.
export function lazyStore<T extends object>(fn: () => T): T {
  return new Proxy<T>({} as T, {
    get(_, prop: string | symbol) {
      return (fn() as any)[prop];
    },
  });
}

export default lazyStore;
