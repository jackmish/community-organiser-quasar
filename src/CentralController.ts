// Top-level controller root for the whole app.
import * as apiStorage from 'src/modules/storage/StorageController';
import { TaskStoreController } from 'src/modules/task/TaskController';
import { GroupStoreController } from 'src/modules/group/GroupController';
import { lazyStore } from 'src/modules/storage/controllers/lazyStore';
import { registerAppService } from 'src/services/appService';
import { initGroupWatchers } from 'src/modules/group/groupWatchers';

class CentralController {
  public group: ReturnType<typeof GroupStoreController> = lazyStore<
    ReturnType<typeof GroupStoreController>
  >(GroupStoreController as any);
  public task: ReturnType<typeof TaskStoreController> = lazyStore<
    ReturnType<typeof TaskStoreController>
  >(TaskStoreController as any);
  private _storage: ReturnType<typeof apiStorage.construct> | null = null;

  constructor() {}

  initControllers() {
    if (this._storage) return this._storage;
    const g = GroupStoreController();
    const t = TaskStoreController();
    this._storage = apiStorage.construct(g, t.time);
    initGroupWatchers(g, this._storage);
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
        return (this.initControllers() as any)[prop];
      },
    });
  }
}

const CC = new CentralController();

export default CC;
