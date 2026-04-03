import type { StorageController, StoragePort } from 'src/modules/storage/StorageController';

/**
 * Lifecycle contract for domain controllers that participate in the CC registry.
 *
 * Implement this interface in any controller class you want to register with
 * CentralController. Boot order is managed by CC.boot() — no per-controller
 * wiring needed in the bootstrap file.
 *
 * @example
 * class MyController implements Controllable {
 *   readonly controllerName = 'my' as const;
 *   storagePort = () => ({ kind: 'time' as const, data: this.time });
 *   onStorageReady = (storage: StorageController) => { ... };
 * }
 */
export interface Controllable {
  /** Matches the property name on the CC tree (e.g. 'task', 'group'). */
  readonly controllerName: string;

  /**
   * Return the data slice this controller exposes to StorageController.
   * Called during CC.boot() before any onStorageReady hooks run.
   */
  storagePort?(): StoragePort;

  /**
   * Called once after all storage ports are connected.
   * Use this instead of initWatchers(storage) — CC.boot() calls it for every
   * registered controller automatically.
   */
  onStorageReady?(storage: StorageController): void;
}
