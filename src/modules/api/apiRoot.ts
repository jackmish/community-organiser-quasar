// apiRoot — index of connected APIs (flat exports)
// Exports (top-level):
// - `initApi()`  : initialize storage API (call from pinia boot)
// - `group`      : group API (Pinia-backed)
// - `task`       : task API (Pinia-backed)
// - `storage`    : storage helpers and functions

import * as apiStorage from '../storage/apiStorage';
import { registerAppService } from 'src/services/appService';
import { useTaskStore } from '../task/apiTask';
import { useGroupStore } from '../group/apiGroup';
import { lazyStore } from './lazyStore';

class ApiRoot {
  public group = lazyStore(useGroupStore);
  public task = lazyStore(useTaskStore);
  private _storage: ReturnType<typeof apiStorage.construct> | null = null;

  initApi() {
    if (this._storage) return this._storage;
    const g = useGroupStore();
    const t = useTaskStore();
    this._storage = apiStorage.construct(g, t.time);
    try {
      registerAppService('storage', this._storage);
    } catch (e) {
      void e;
    }
    return this._storage;
  }

  get storage() {
    return new Proxy({} as any, {
      get: (_t, prop: string | symbol) => {
        return (this.initApi() as any)[prop];
      },
    });
  }
}

const apiRoot = new ApiRoot();

// Export a single default instance (the simple "one-line" export you wanted)
export default apiRoot;

// Keep named exports for backward compatibility so callers using `api.task` still work.
export const group = apiRoot.group;
export const task = apiRoot.task;
export const storage = apiRoot.storage;
export const initApi = apiRoot.initApi.bind(apiRoot);
