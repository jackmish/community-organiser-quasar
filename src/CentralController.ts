// Top-level controller root for the whole app.
import * as apiStorage from 'src/modules/storage/StorageController';
import { useTaskStore } from 'src/modules/task/TaskController';
import { useGroupStore } from 'src/modules/group/GroupController';
import { lazyStore } from 'src/modules/controllers/lazyStore';
import { registerAppService } from 'src/services/appService';

class CentralController {
  // Use `any` here to reflect the dynamic Pinia store shape at runtime
  // and avoid excessive casting across the codebase.
  public group: any = lazyStore(useGroupStore as any);
  public task: any = lazyStore(useTaskStore as any);
  private _storage: ReturnType<typeof apiStorage.construct> | null = null;

  constructor() {}

  initControllers() {
    if (this._storage) return this._storage;
    const g = useGroupStore();
    const t = useTaskStore();
    this._storage = apiStorage.construct(g, t.time as any);
    try {
      // lazy register app service so `saveData()` and other helpers can find it
      // keep silent on errors to match prior behavior
      registerAppService('storage', this._storage);
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
