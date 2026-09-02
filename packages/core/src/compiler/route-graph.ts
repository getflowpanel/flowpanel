export type RouteOwnerKind = "resource" | "dashboard" | "page" | "queue";

interface RouteOwner {
  kind: RouteOwnerKind;
  name: string;
}

const SAFE_SEGMENT = /^[A-Za-z][A-Za-z0-9_-]*$/;

/** Normalize a user-facing page path without changing which route it identifies. */
export function normalizeRoutePath(raw: string): string {
  let path = raw.trim();
  if (path === "" || path === "/") return "/";
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.endsWith("/")) path = path.slice(0, -1);

  const segments = path.slice(1).split("/");
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error(`"${raw}" is not a safe route path: dot segments are not allowed.`);
  }
  const unsafe = segments.find((segment) => !SAFE_SEGMENT.test(segment));
  if (unsafe !== undefined) {
    throw new Error(
      `"${raw}" is not a safe route path: segment "${unsafe}" must start with a letter and ` +
        "use only ASCII letters, numbers, underscores, or hyphens.",
    );
  }
  return path;
}

/** Tracks case-insensitive route ownership so deployments never receive ambiguous paths. */
export class RouteNameRegistry {
  readonly #owners = new Map<string, RouteOwner>();
  readonly #paths = new Map<string, RouteOwner>();

  add(kind: RouteOwnerKind, name: string): void {
    if (!SAFE_SEGMENT.test(name)) {
      throw new Error(
        `${kind} "${name}" must be a safe ASCII route identifier: start with a letter and ` +
          "use only letters, numbers, underscores, or hyphens.",
      );
    }
    const key = name.toLocaleLowerCase("en-US");
    const existing = this.#owners.get(key);
    if (existing) {
      throw new Error(
        `Route name collision: ${existing.kind} "${existing.name}" conflicts with ` +
          `${kind} "${name}". Route names are case-insensitive.`,
      );
    }
    this.#owners.set(key, { kind, name });
  }

  addPath(kind: RouteOwnerKind, path: string, name = path): void {
    const key = path.toLocaleLowerCase("en-US");
    const existing = this.#paths.get(key);
    if (existing) {
      throw new Error(
        `Route path collision: ${existing.kind} "${existing.name}" conflicts with ` +
          `${kind} "${name}" at "${path}". Route paths are case-insensitive.`,
      );
    }
    this.#paths.set(key, { kind, name });
  }
}
