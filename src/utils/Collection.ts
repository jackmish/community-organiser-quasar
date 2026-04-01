/**
 * Collection<T>
 *
 * Abstract base for flat-list facades.  Subclasses implement one method —
 * `items()` — and inherit all generic array-pipeline operations for free.
 *
 * Domain-specific methods (e.g. `byGroup`, `forDay`, tree helpers) live on
 * the concrete subclass only.
 */
export abstract class Collection<T> {
  /** Live reference to the underlying array. Do not mutate the result. */
  abstract items(): T[];

  /** Shallow clone — safe to sort or mutate. */
  itemsClone(): T[] {
    return this.items().slice();
  }

  // ── Filtering ─────────────────────────────────────────────────────────────

  /** Items where `item[key] === value`. */
  where<K extends keyof T>(key: K, value: T[K]): T[] {
    return this.items().filter((i) => i[key] === value);
  }

  /** Filter by an arbitrary predicate. */
  filter(fn: (i: T) => boolean): T[] {
    return this.items().filter(fn);
  }

  // ── Access ────────────────────────────────────────────────────────────────

  /** First item overall, or first matching a predicate. */
  first(fn?: (i: T) => boolean): T | undefined {
    const arr = this.items();
    return fn ? arr.find(fn) : arr[0];
  }

  /** Last item overall, or last matching a predicate. */
  last(fn?: (i: T) => boolean): T | undefined {
    const arr = this.items();
    if (fn) return [...arr].reverse().find(fn);
    return arr[arr.length - 1];
  }

  // ── Aggregates ────────────────────────────────────────────────────────────

  /** True when the collection is empty. */
  isEmpty(): boolean {
    return this.items().length === 0;
  }

  /** Total count, or count of items matching a predicate. */
  count(fn?: (i: T) => boolean): number {
    const arr = this.items();
    return fn ? arr.filter(fn).length : arr.length;
  }

  /** Reduce over all items. */
  aggregate<R>(fn: (acc: R, i: T) => R, init: R): R {
    return this.items().reduce(fn, init);
  }

  // ── Transformation ────────────────────────────────────────────────────────

  /** Sort with an optional comparator; returns a new array. */
  sort(compare?: (a: T, b: T) => number): T[] {
    return this.items().slice().sort(compare);
  }

  /** Bucket items by a property value. */
  groupBy<K extends keyof T>(key: K): Map<T[K], T[]> {
    const result = new Map<T[K], T[]>();
    for (const i of this.items()) {
      const k = i[key];
      const bucket = result.get(k);
      if (bucket) bucket.push(i);
      else result.set(k, [i]);
    }
    return result;
  }

  /** Extract a single property from every item. */
  pluck<K extends keyof T>(key: K): T[K][] {
    return this.items().map((i) => i[key]);
  }
}
