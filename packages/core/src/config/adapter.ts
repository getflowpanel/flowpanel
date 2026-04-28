/**
 * FlowPanelAdapter — the public contract returned by `drizzleAdapter()` and
 * `prismaAdapter()`. Users never implement this themselves; they call one
 * of the factory functions and pass the result to `defineFlowPanel({adapter})`.
 *
 * The type is structured as a union to accept legacy shapes (raw Prisma
 * client, raw Drizzle db, plain SqlExecutor) for backward compat — but the
 * canonical shape is `{ sql, resource }`. Adapter factories return that
 * shape branded with `__fpAdapter: true` so consumer code can narrow the
 * union without casts.
 */

import type { ResourceAdapter } from "../resource/types";
import type { SqlExecutor, SqlExecutorFactory } from "../types/db";

/** Canonical adapter shape — what `drizzleAdapter()` / `prismaAdapter()` return. */
export interface CanonicalAdapter {
  readonly sql: SqlExecutor;
  readonly resource: ResourceAdapter;
  /** Runtime brand — lets the zod validator accept the shape unambiguously. */
  readonly __fpAdapter?: true;
}

/**
 * What users may pass to `defineFlowPanel({adapter})`. The canonical path is
 * `drizzleAdapter(...)` / `prismaAdapter(...)`, but the runtime also accepts
 * a raw `SqlExecutor`, a factory function, a raw PrismaClient, or a raw
 * Drizzle db for pipeline-only deployments without a resource UI.
 */
export type FlowPanelAdapter =
  | CanonicalAdapter
  | SqlExecutor
  | SqlExecutorFactory
  // Raw PrismaClient — auto-wrapped at load time.
  | { $queryRawUnsafe: (...args: unknown[]) => unknown }
  // Raw Drizzle db — auto-wrapped at load time.
  | { select: (...args: unknown[]) => unknown; insert: (...args: unknown[]) => unknown };

/**
 * Brand a factory result so TypeScript narrows the adapter union to
 * `CanonicalAdapter` instead of leaving it as the full 5-branch union.
 * Adapter factories apply this to their return value.
 */
export function brandAdapter<T extends { sql: SqlExecutor; resource: ResourceAdapter }>(
  result: T,
): T & { readonly __fpAdapter: true } {
  return Object.assign(result, { __fpAdapter: true as const });
}
