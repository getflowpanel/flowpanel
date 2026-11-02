import { FlowpanelConfigError } from "../types/config-error";

export type RouteOwnerKind = "resource" | "dashboard" | "page" | "queue";

interface RouteOwner {
  kind: RouteOwnerKind;
  name: string;
}

const SAFE_SEGMENT = /^[A-Za-z][A-Za-z0-9_-]*$/;

/** Normalize a user-facing page path without changing which route it identifies. */
export function normalizeRoutePath(raw: string, where: string): string {
  let path = raw.trim();
  if (path === "" || path === "/") return "/";
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.endsWith("/")) path = path.slice(0, -1);

  const segments = path.slice(1).split("/");
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new FlowpanelConfigError(
      where,
      `"${raw}" has a dot segment, which a route path cannot have. Remove the "." or ".." segment.`,
    );
  }
  const unsafe = segments.find((segment) => !SAFE_SEGMENT.test(segment));
  if (unsafe !== undefined) {
    throw new FlowpanelConfigError(
      where,
      `"${raw}" has the segment "${unsafe}", which a route path cannot have. Start each segment ` +
        "with a letter and use only ASCII letters, numbers, underscores or hyphens.",
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
      throw new FlowpanelConfigError(
        `${kind} "${name}"`,
        "the name is not a safe route identifier. Start it with a letter and use only ASCII " +
          "letters, numbers, underscores or hyphens.",
      );
    }
    const key = name.toLocaleLowerCase("en-US");
    const existing = this.#owners.get(key);
    if (existing) {
      throw new FlowpanelConfigError(
        `${kind} "${name}"`,
        `the name collides with ${existing.kind} "${existing.name}", because route names ignore ` +
          "case. Rename one of them.",
      );
    }
    this.#owners.set(key, { kind, name });
  }

  addPath(kind: RouteOwnerKind, path: string, name = path): void {
    const key = path.toLocaleLowerCase("en-US");
    const existing = this.#paths.get(key);
    if (existing) {
      throw new FlowpanelConfigError(
        `${kind} "${name}"`,
        `its path "${path}" collides with ${existing.kind} "${existing.name}", because route ` +
          "paths ignore case. Move one of them.",
      );
    }
    this.#paths.set(key, { kind, name });
  }
}
