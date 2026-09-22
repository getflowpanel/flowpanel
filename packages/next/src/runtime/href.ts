import type { ResolvedAdminConfig } from "@flowpanel/core";
import { withDeploymentBasePath } from "@flowpanel/core/paths";

/**
 * One URL path atom — a resource name, a record identifier, a literal segment.
 * Identifiers carry `/`, `%`, `?` and `#` in real data, and every one of those
 * changes the route unless it is escaped here.
 */
export function encodeAtom(value: string | number): string {
  return encodeURIComponent(String(value));
}

function join(config: ResolvedAdminConfig, parts: string[]): string {
  if (parts.length === 0) return config.basePath || "/";
  return `${config.basePath}/${parts.join("/")}`;
}

/**
 * Build a URL under the admin's `basePath` from identity atoms. Every atom is
 * kept as it is: a leading slash and an empty string are values a key column can
 * hold, and rewriting them would address a different record. Callers that have no
 * identifier build no URL — see `identityOf` in the table.
 */
export function buildHref(
  config: ResolvedAdminConfig,
  ...segments: ReadonlyArray<string | number>
): string {
  return join(config, segments.map(encodeAtom));
}

/**
 * Build a URL from a configured nested path such as `/reports/weekly`, where the
 * separators are part of the route rather than part of a single atom.
 */
export function buildPath(config: ResolvedAdminConfig, path: string): string {
  return join(config, path.split("/").filter(Boolean).map(encodeAtom));
}

/**
 * A URL the browser requests itself — a form `action` or a fetch. Unlike a Link
 * or a router navigation, it carries no deployment `basePath` unless we add it.
 */
export function buildApiHref(
  config: ResolvedAdminConfig,
  ...segments: ReadonlyArray<string | number>
): string {
  const path = segments.map((segment) => encodeAtom(String(segment))).join("/");
  return withDeploymentBasePath(path === "" ? config.paths.api : `${config.paths.api}/${path}`);
}

/** Decode one catch-all page segment, leaving a malformed escape as it arrived. */
export function decodeAtom(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
