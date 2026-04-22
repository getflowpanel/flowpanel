/**
 * Pages Resolver — normalizes user-declared FlowPanelPage entries and
 * evaluates access rules for serialization.
 */

import { FlowPanelConfigError } from "../errors";
import type {
  FlowPanelPage,
  PageAccessContext,
  PageAccessRule,
  ResolvedPage,
  SerializedPage,
} from "./types";

// ---------------------------------------------------------------------------
// Reserved identifiers — pages cannot collide with these
// ---------------------------------------------------------------------------

const RESERVED_PAGE_IDS = new Set(["dashboard", "pipeline"]);

// ---------------------------------------------------------------------------
// Label helpers
// ---------------------------------------------------------------------------

/**
 * Convert a kebab/snake-case path to a Title Case label.
 *   "support-tickets" → "Support Tickets"
 *   "api_keys"         → "Api Keys"
 *   "reports"          → "Reports"
 */
function pathToLabel(path: string): string {
  return path
    .split(/[-_/]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validatePath(path: string): void {
  if (!path || typeof path !== "string") {
    throw new FlowPanelConfigError(
      `FlowPanel pages: "path" must be a non-empty string, got ${JSON.stringify(path)}`,
    );
  }
  if (path.startsWith("/")) {
    throw new FlowPanelConfigError(
      `FlowPanel pages: "path" must not start with "/". Got "${path}". ` +
        `Pages are mounted under the admin base path automatically — use "${path.slice(1)}" instead.`,
    );
  }
  if (!/^[a-z0-9][a-z0-9\-_/]*$/i.test(path)) {
    throw new FlowPanelConfigError(
      `FlowPanel pages: "path" must match /^[a-z0-9][a-z0-9\\-_/]*$/i. Got "${path}".`,
    );
  }
  if (RESERVED_PAGE_IDS.has(path)) {
    throw new FlowPanelConfigError(
      `FlowPanel pages: path "${path}" is reserved. ` + `Rename your page (e.g. "${path}-page").`,
    );
  }
}

function validateComponent(path: string, component: unknown): void {
  if (component === null || component === undefined) {
    throw new FlowPanelConfigError(
      `FlowPanel pages: page "${path}" is missing a "component". ` +
        `Pass a React component: { path: "${path}", component: MyPage }.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Resolve
// ---------------------------------------------------------------------------

/**
 * Resolve user-declared pages into their internal form. Validates paths,
 * checks for duplicates, and normalizes labels.
 *
 * Does NOT evaluate access — that happens in `serializePages` per-request.
 */
export function resolvePages(
  pages: readonly FlowPanelPage[] | undefined,
  options: {
    /** Resource ids that already exist — pages can't collide with them. */
    resourceIds?: readonly string[];
    /** Queue ids that already exist — pages can't collide with them. */
    queueIds?: readonly string[];
  } = {},
): ResolvedPage[] {
  if (!pages || pages.length === 0) return [];

  const resolved: ResolvedPage[] = [];
  const seen = new Set<string>();
  const resourceIds = new Set(options.resourceIds ?? []);
  const queueIds = new Set(options.queueIds ?? []);

  for (const page of pages) {
    validatePath(page.path);
    validateComponent(page.path, page.component);

    if (seen.has(page.path)) {
      throw new FlowPanelConfigError(`FlowPanel pages: duplicate path "${page.path}".`);
    }
    if (resourceIds.has(page.path)) {
      throw new FlowPanelConfigError(
        `FlowPanel pages: path "${page.path}" collides with a resource of the same id. ` +
          `Rename the page.`,
      );
    }
    if (queueIds.has(page.path)) {
      throw new FlowPanelConfigError(
        `FlowPanel pages: path "${page.path}" collides with a queue of the same id. ` +
          `Rename the page.`,
      );
    }
    seen.add(page.path);

    resolved.push({
      id: page.path,
      path: page.path,
      component: page.component,
      label: page.label ?? pathToLabel(page.path),
      icon: page.icon,
      group: page.group,
      access: page.access,
    });
  }

  return resolved;
}

// ---------------------------------------------------------------------------
// Access evaluation (role-based; function access is decided client-side or
// server-side at the route level — here we optimistically allow, mirroring
// resource-action serialization).
// ---------------------------------------------------------------------------

function evaluateAccess(
  rule: PageAccessRule | undefined,
  sessionRoles: readonly string[],
): boolean {
  if (rule === undefined) return true;
  if (rule === true) return true;
  if (rule === false) return false;
  if (Array.isArray(rule)) return rule.some((r) => sessionRoles.includes(r));
  // Function rule: evaluated by caller with full context. Default: allow.
  if (typeof rule === "function") return true;
  return true;
}

/** Serialize pages for client consumption, stripping components and access fns. */
export function serializePages(
  pages: readonly ResolvedPage[],
  sessionRoles: readonly string[] = [],
): SerializedPage[] {
  return pages.map((p) => {
    const serialized: SerializedPage = {
      id: p.id,
      path: p.path,
      label: p.label,
      allowed: evaluateAccess(p.access, sessionRoles),
    };
    if (p.icon !== undefined) serialized.icon = p.icon;
    if (p.group !== undefined) serialized.group = p.group;
    return serialized;
  });
}

/**
 * Evaluate function-typed access rules with full context. Called server-side
 * when routing to a page — if false, route responds 403 / sidebar hides entry.
 */
export async function canAccessPage(
  page: ResolvedPage,
  ctx: PageAccessContext,
  sessionRoles: readonly string[] = [],
): Promise<boolean> {
  const rule = page.access;
  if (rule === undefined) return true;
  if (rule === true) return true;
  if (rule === false) return false;
  if (Array.isArray(rule)) return rule.some((r) => sessionRoles.includes(r));
  if (typeof rule === "function") {
    try {
      const result = await Promise.resolve(rule(ctx));
      return Boolean(result);
    } catch {
      return false;
    }
  }
  return true;
}
