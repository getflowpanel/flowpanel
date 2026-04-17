/**
 * Path Proxy — converts `(p) => p.user.email` into a branded Path object
 * carrying the string representation `"user.email"` and segments `["user", "email"]`.
 */

const PATH_BRAND = Symbol.for("flowpanel.path");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Path<_TRoot = unknown, _TLeaf = unknown> {
  readonly [PATH_BRAND]: true;
  readonly _segments: readonly string[];
}

/**
 * Recursive mapped type for autocomplete. The runtime Proxy handles unlimited
 * depth, so we don't need to worry about TypeScript's recursion limits for
 * the runtime — only for IDE type inference.
 */
export type PathProxy<T> = {
  [K in keyof T]-?: T[K] extends object ? PathProxy<T[K]> & Path<T, T[K]> : Path<T, T[K]>;
};

export type PathFn<TRow> = (p: PathProxy<TRow>) => Path<TRow, unknown>;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function makePath(segments: readonly string[]): Path {
  return {
    [PATH_BRAND]: true,
    _segments: segments,
  };
}

function makeProxy<T>(segments: readonly string[]): PathProxy<T> {
  // The current accumulated path is also a valid Path (for leaf access)
  const pathObj = makePath(segments);

  return new Proxy(pathObj as unknown as PathProxy<T>, {
    get(target, prop: string | symbol) {
      // Pass through own properties of the path object (brand + _segments)
      if (prop === PATH_BRAND || prop === "_segments") {
        return (target as unknown as Record<string | symbol, unknown>)[prop];
      }
      // Any other property access extends the path
      if (typeof prop === "string") {
        return makeProxy([...segments, prop]);
      }
      // Symbols other than our brand: reflect normally
      return Reflect.get(target, prop);
    },
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates a root PathProxy. Property accesses record the path.
 *
 * Each property access returns a NEW proxy with accumulated segments,
 * so multiple accesses from the same proxy are independent (immutable).
 */
export function createPathProxy<T>(): PathProxy<T> {
  return makeProxy<T>([]);
}

/**
 * Returns the dot-joined path string, e.g. `"user.email"`.
 */
export function getPathString(path: Path): string {
  return path._segments.join(".");
}

/**
 * Returns the path segments array, e.g. `["user", "email"]`.
 */
export function getPathSegments(path: Path): readonly string[] {
  return path._segments;
}

/**
 * Type guard — returns true if the value is a branded Path object.
 */
export function isPath(value: unknown): value is Path {
  return (
    value !== null &&
    typeof value === "object" &&
    (value as Record<symbol, unknown>)[PATH_BRAND] === true
  );
}

/**
 * Calls `fn(createPathProxy())` and returns the resulting Path.
 */
export function resolvePath<TRow>(fn: PathFn<TRow>): Path<TRow, unknown> {
  return fn(createPathProxy<TRow>());
}

/**
 * Resolves an array of PathFns to their dot-joined string representations.
 */
export function resolvePathStrings<TRow>(fns: PathFn<TRow>[]): string[] {
  return fns.map((fn) => getPathString(resolvePath(fn)));
}
