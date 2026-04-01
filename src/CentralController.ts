// Top-level controller root for the whole app.
import * as apiStorage from 'src/modules/storage/StorageController';
import { useTaskController } from 'src/modules/task/TaskController';
import { useGroupController } from 'src/modules/group/GroupController';
import { lazyStore } from 'src/modules/storage/controllers/lazyStore';
import { registerAppService } from 'src/services/appService';

class CentralController {
  public group: ReturnType<typeof useGroupController> = lazyStore<
    ReturnType<typeof useGroupController>
  >(useGroupController as any);
  public task: ReturnType<typeof useTaskController> = lazyStore<
    ReturnType<typeof useTaskController>
  >(useTaskController as any);
  private _storage: ReturnType<typeof apiStorage.construct> | null = null;

  constructor() {}

  initControllers() {
    if (this._storage) return this._storage;
    const g = useGroupController();
    const t = useTaskController();
    this._storage = apiStorage.construct(g, t.time);
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
