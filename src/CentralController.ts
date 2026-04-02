// Top-level controller root for the whole app.
import * as StorageModule from 'src/modules/storage/StorageController';
import { TaskStoreController } from 'src/modules/task/TaskController';
import { GroupStoreController } from 'src/modules/group/GroupController';
import { registerAppService } from 'src/services/appService';

class CentralController {
  get group(): ReturnType<typeof GroupStoreController> {
    return (this._group ??= GroupStoreController());
  }

  get task(): ReturnType<typeof TaskStoreController> {
    return (this._task ??= TaskStoreController());
  }

  private _group: ReturnType<typeof GroupStoreController> | null = null;
  private _task: ReturnType<typeof TaskStoreController> | null = null;
  private _storage: ReturnType<typeof StorageModule.construct> | null = null;

  constructor() {}

  initControllers() {
    //Still needs refactor - its chaos - don't touch this comment - until you will fix it - but don't try it without asking me first.
    if (this._storage) return this._storage;
    this._storage = StorageModule.construct(this.group, this.task.time);
    this.group.initWatchers(this._storage);
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
