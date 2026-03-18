// Top-level controller root for the whole app.
import * as apiStorage from 'src/modules/storage/StorageController';
import { useTaskStore } from 'src/modules/task/TaskController';
import { useGroupStore } from 'src/modules/group/GroupController';
import { lazyStore } from 'src/modules/controllers/lazyStore';

class CentralController {
  public group = lazyStore(useGroupStore as any);
  public task = lazyStore(useTaskStore as any);
  private _storage: ReturnType<typeof apiStorage.construct> | null = null;

  constructor() {
    this.initControllers();
  }

  initControllers() {
    if (this._storage) return this._storage;
    const g = useGroupStore();
    const t = useTaskStore();
    this._storage = apiStorage.construct(g, t.time as any);
    try {
      // lazy register app service if available
      // keep silent on errors to match prior behavior
      // registerAppService('storage', this._storage);
    } catch (e) {
      void e;
    }
    return this._storage;
  }

  get storage() {
    return new Proxy({} as any, {
      get: (_t, prop: string | symbol) => {
        return (this.initControllers() as any)[prop];
      },
    });
  }
}

const CC = new CentralController();

export default CC;
