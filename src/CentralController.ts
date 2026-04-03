/**
 * CentralController (CC) — the single source of truth for the app's domain controllers.
 *
 * Usage
 * ─────
 *   import CC from 'src/CentralController';
 *   CC.task.add(date, data);
 *   CC.group.active.set(group);
 *   CC.storage.loadData();
 *
 * Extending
 * ─────────
 * To add a new domain controller:
 *   1. Implement the `Controllable` interface in the controller class.
 *   2. Add one _lazy() backing field and one public typed getter (follow the task/group pattern).
 *   3. CC.boot() picks it up automatically — no other changes needed.
 */
import { StorageController } from 'src/modules/storage/StorageController';
import { TaskStoreController } from 'src/modules/task/TaskController';
import { GroupStoreController } from 'src/modules/group/GroupController';
import { registerAppService } from 'src/services/appService';
import type { Controllable } from 'src/types/Controllable';

class CentralController {
  // ── Public typed tree ──────────────────────────────────────────────────────

  get task() {
    return this._taskFn();
  }

  get group() {
    return this._groupFn();
  }

  /** Storage is always available synchronously — no lazy init required. */
  readonly storage = new StorageController();

  // ── Registry ───────────────────────────────────────────────────────────────

  private readonly _registrations: Array<() => Controllable> = [];
  private readonly _cache = new Map<string, Controllable>();
  private _booted = false;

  /**
   * Register a controller factory under a name.
   * Returns a lazy getter that creates the Pinia store on first access.
   * The factory runs during CC.boot() — safely after Pinia is active.
   */
  private _lazy<C extends Controllable>(name: string, factory: () => C): () => C {
    const get = (): C => {
      if (!this._cache.has(name)) this._cache.set(name, factory());
      return this._cache.get(name) as C;
    };
    this._registrations.push(get);
    return get;
  }

  // Declared in boot order: group loads data, task exposes time slice
  private readonly _groupFn = this._lazy('group', () => GroupStoreController());
  private readonly _taskFn = this._lazy('task', () => TaskStoreController());

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  /**
   * Call once from app boot after Pinia is active (see boot/pinia.ts).
   *
   * Order of operations:
   *   1. Eagerly initialise all registered controllers (inside Pinia context).
   *   2. Connect each controller's storage port — no constructor injection needed.
   *   3. Run each controller's onStorageReady hook — no per-controller wiring needed.
   *   4. Register storage with appService.
   */
  boot(): void {
    if (this._booted) return;
    this._booted = true;

    const all = this._registrations.map((fn) => fn());

    for (const ctrl of all) {
      if (ctrl.storagePort) this.storage.connect(ctrl.storagePort());
    }

    for (const ctrl of all) {
      ctrl.onStorageReady?.(this.storage);
    }

    try {
      registerAppService('storage', this.storage);
    } catch {
      // no-op: already registered in HMR / double-init scenarios
    }
  }
}

const CC = new CentralController();

export default CC;
