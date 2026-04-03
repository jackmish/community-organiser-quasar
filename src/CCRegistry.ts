/**
 * CCRegistry — lightweight typed registry for domain controllers.
 *
 * Each `.register()` call is self-contained and flows the controller type forward,
 * so the resulting `.access` proxy is fully inferred without manual typing.
 *
 * Usage (see CentralController.ts for the live wiring):
 * ────────────────────────────────────────────────────
 *   export const CCReg = new CCRegistry()
 *     .register('group', GroupStoreController)
 *     .register('task',  TaskStoreController);
 *
 *   export const CC = CCReg.access;
 *   // ↳ CC.group / CC.task / CC.storage are all typed
 *
 * External registration (from any module, before boot):
 * ──────────────────────────────────────────────────────
 *   import { CCReg } from 'src/CentralController';
 *   CCReg.register('calendar', CalendarStoreController);
 *   // Access at runtime: CCReg.get('calendar')
 */
import { StorageController } from 'src/modules/storage/StorageController';
import { registerAppService } from 'src/services/appService';
import type { Controllable } from 'src/types/Controllable';

// Inferred access shape: each registered key maps to its controller instance
type CCAccess<TMap extends Record<string, Controllable>> = {
  readonly [K in keyof TMap]: TMap[K];
} & { readonly storage: StorageController };

export class CCRegistry<TMap extends Record<string, Controllable> = Record<never, never>> {
  /** Storage is always available synchronously — not lazy, not port-injected. */
  readonly storage = new StorageController();

  private readonly _registrations: Array<[string, () => Controllable]> = [];
  private readonly _cache = new Map<string, Controllable>();
  private _booted = false;

  /**
   * Register a domain controller factory.
   *
   * Returns `this` with the new key added to the generic type map, so
   * fluent chaining accumulates the full inferred shape for `.access`.
   *
   * @example
   * const reg = new CCRegistry()
   *   .register('group', GroupStoreController)  // type: { group: GroupInstance }
   *   .register('task',  TaskStoreController);  // type: { group: …, task: TaskInstance }
   */
  register<K extends string, C extends Controllable>(
    key: K,
    factory: () => C,
  ): CCRegistry<TMap & Record<K, C>> {
    this._registrations.push([key, factory]);
    return this as unknown as CCRegistry<TMap & Record<K, C>>;
  }

  /**
   * Retrieve a registered controller by key.
   * Lazily initialises the factory on first access (mirrors proxy behaviour).
   * Throws only if the key was never registered at all.
   */
  get<K extends keyof TMap>(key: K): TMap[K] {
    const k = key as string;
    if (!this._cache.has(k)) {
      const entry = this._registrations.find(([rk]) => rk === k);
      if (!entry)
        throw new Error(`[CCRegistry] '${k}' is not registered. Did you call .register('${k}', ...)?`);
      this._cache.set(k, entry[1]());
    }
    return this._cache.get(k) as TMap[K];
  }

  /**
   * Typed proxy object for reading controllers.
   * Exported as `CC` — the public access surface.
   *
   * `CC.storage` is always live; every other key reads from the boot cache.
   */
  get access(): CCAccess<TMap> {
    return new Proxy({} as CCAccess<TMap>, {
      get: (_t, prop: string) => {
        if (prop === 'storage') return this.storage;
        // Lazy-init on first access so tests (and HMR) work without an explicit boot() call.
        // boot() still runs the full wiring pass; this just ensures factories are callable
        // as soon as Pinia is active.
        if (!this._cache.has(prop)) {
          const entry = this._registrations.find(([k]) => k === prop);
          if (entry) this._cache.set(prop, entry[1]());
        }
        return this._cache.get(prop);
      },
    });
  }

  /**
   * Call once from app boot after Pinia is active (boot/pinia.ts).
   *
   * Order of operations, in one pass each:
   *   1. Eagerly init all registered controllers (factories run inside Pinia context).
   *   2. Connect each controller's storage port — no constructor injection needed.
   *   3. Run each controller's onStorageReady hook.
   *   4. Register storage with appService.
   */
  boot(): void {
    if (this._booted) return;
    this._booted = true;

    for (const [key, factory] of this._registrations) {
      if (!this._cache.has(key)) this._cache.set(key, factory());
    }

    const all = [...this._cache.values()];

    for (const ctrl of all) {
      if (ctrl.storagePort) this.storage.connect(ctrl.storagePort());
    }

    for (const ctrl of all) {
      ctrl.onStorageReady?.(this.storage);
    }

    try {
      registerAppService('storage', this.storage);
    } catch {
      // already registered — HMR / double-init guard
    }
  }
}
