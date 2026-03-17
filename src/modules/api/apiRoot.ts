import * as apiStorage from '../storage/apiStorage';
import { registerAppService } from 'src/services/appService';
import { useTaskStore } from '../task/apiTask';
import { useGroupStore } from '../group/apiGroup';

function lazyStore<T extends object>(fn: () => T): T {
  return new Proxy<T>({} as T, {
    get(_, prop: string | symbol) {
      return (fn() as any)[prop];
    },
  });
}

// ── Storage lazy singleton ────────────────────────────────────────────────────
// apiStorage keeps the factory pattern (non-Pinia) – it is created exactly once
// after Pinia is active. Call `initApi()` from the pinia boot file.
let _storage: ReturnType<typeof apiStorage.construct> | null = null;

export function initApi() {
  if (_storage) return _storage;
  const g = useGroupStore();
  const t = useTaskStore();
  _storage = apiStorage.construct(g, t.time);
  try {
    registerAppService('storage', _storage);
  } catch (e) {
    void e;
  }
  return _storage;
}

// ── Public API exports ────────────────────────────────────────────────────────
// Components continue to `import * as api from 'src/modules/day-organiser/apiRoot'`
// and use `api.task.*`, `api.group.*`, `api.storage.*` exactly as before.

// `as any` preserves the original API contract used by all consumers – Pinia's
// conditional-type helpers can't express markRaw nested namespaces, so we keep
// downstream callers working the same way the old factory pattern did.
export const group = lazyStore(useGroupStore);
export const task = lazyStore(useTaskStore);

// Storage is also proxied lazily so the first access triggers initApi()
export const storage = new Proxy({} as any, {
  get(_, prop: string | symbol) {
    return (initApi() as any)[prop];
  },
});
