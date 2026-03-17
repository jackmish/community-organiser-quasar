export function lazyStore<T extends object>(fn: () => T): T {
  return new Proxy<T>({} as T, {
    get(_, prop: string | symbol) {
      return (fn() as any)[prop];
    },
  });
}

export default lazyStore;
