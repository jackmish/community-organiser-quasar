export interface ActiveInterface<T = any> {
  /**
   * Set the active using the full group/model object. Implementations
   * should expect a proper group instance and not perform type-guessing.
   */
  set(value: T | null): void;

  /**
   * Set the active by id. Accepts a string id (or null to clear).
   */
  setById(id: string | null): void;

  /**
   * Get the current active model instance (of type `T`) or null.
   */
  get(): T | null;
}
