/**
 * Runtime adapter detection for `defineFlowPanel({ adapter })`.
 *
 * Users can hand us any of five shapes, and we figure out which one:
 *
 *   1. `{ sql, resource }` — the canonical `drizzleAdapter()/prismaAdapter()` result.
 *   2. `SqlExecutor`        — pipeline-only usage, no resource routing.
 *   3. `SqlExecutorFactory` — async resolver (lazy db creation).
 *   4. `PrismaClient`       — auto-wrapped via loaded @flowpanel/adapter-prisma.
 *   5. `Drizzle` db         — auto-wrapped via loaded @flowpanel/adapter-drizzle.
 *
 * The goal: you pass `adapter: db` for the common case and it just works.
 * The escape hatch: pass the adapter factory result explicitly for full control.
 */

import type { ResourceAdapter } from "../resource/types";
import type { SqlExecutor } from "../types/db";

export interface AdapterResult {
  sql: SqlExecutor;
  resource?: ResourceAdapter;
}

/**
 * Loads an optional peer dependency without tripping bundler static analyzers.
 *
 * Webpack / Next.js reads every `require("literal")` at build time and will
 * fail the client bundle even when the call site is unreachable. Constructing
 * the require via `Function("return require")` hides it from static analysis
 * while still working in any CJS-wrapped runtime (Node, Next SSR, webpack
 * server bundles). Returns `null` in pure ESM Node — consumers that hit this
 * path should pass the adapter explicitly.
 */
function loadOptionalPeer<T>(spec: string): T | null {
  try {
    const dynamicRequire = Function(
      "spec",
      "return typeof require === 'function' ? require(spec) : null",
    ) as (s: string) => T | null;
    return dynamicRequire(spec);
  } catch {
    return null;
  }
}

function isAdapterResult(input: unknown): input is { sql: SqlExecutor; resource: ResourceAdapter } {
  if (input === null || typeof input !== "object") return false;
  const obj = input as Record<string, unknown>;
  return (
    obj.sql !== undefined &&
    typeof obj.sql === "object" &&
    obj.sql !== null &&
    "execute" in (obj.sql as object) &&
    obj.resource !== undefined &&
    typeof obj.resource === "object" &&
    obj.resource !== null &&
    "findMany" in (obj.resource as object)
  );
}

export function isSqlExecutor(input: unknown): input is SqlExecutor {
  if (input === null || typeof input !== "object") return false;
  const obj = input as Record<string, unknown>;
  return (
    typeof obj.execute === "function" && typeof obj.transaction === "function" && "dialect" in obj
  );
}

function isPrismaClient(input: unknown): boolean {
  if (input === null || typeof input !== "object") return false;
  const obj = input as Record<string, unknown>;
  return typeof obj.$queryRawUnsafe === "function";
}

function isDrizzleDb(input: unknown): boolean {
  if (input === null || typeof input !== "object") return false;
  const obj = input as Record<string, unknown>;
  return typeof obj.select === "function" && typeof obj.insert === "function";
}

export function detectAdapter(input: unknown): AdapterResult {
  // 1. Already a { sql, resource } adapter result.
  if (isAdapterResult(input)) {
    return input;
  }

  // 2. Direct SqlExecutor (pipeline-only usage).
  if (isSqlExecutor(input)) {
    return { sql: input };
  }

  // 3. SqlExecutorFactory function — the lazy branch.
  if (typeof input === "function") {
    return { sql: input as unknown as SqlExecutor };
  }

  // 4. PrismaClient — auto-wrap.
  if (isPrismaClient(input)) {
    const mod = loadOptionalPeer<{
      prismaAdapter: (opts: { prisma: unknown }) => AdapterResult;
    }>("@flowpanel/adapter-prisma");
    if (!mod) {
      throw new Error(
        "adapter: PrismaClient detected but @flowpanel/adapter-prisma could not be loaded. " +
          "Install it (pnpm add @flowpanel/adapter-prisma), or pass prismaAdapter({ prisma }) explicitly.",
      );
    }
    return mod.prismaAdapter({ prisma: input });
  }

  // 5. Drizzle db — auto-wrap.
  if (isDrizzleDb(input)) {
    const mod = loadOptionalPeer<{
      drizzleAdapter: (opts: { db: unknown }) => AdapterResult;
    }>("@flowpanel/adapter-drizzle");
    if (!mod) {
      throw new Error(
        "adapter: Drizzle db detected but @flowpanel/adapter-drizzle could not be loaded. " +
          "Install it (pnpm add @flowpanel/adapter-drizzle), or pass drizzleAdapter({ db }) explicitly.",
      );
    }
    return mod.drizzleAdapter({ db: input });
  }

  throw new Error(
    "Unrecognized adapter. Pass a PrismaClient, Drizzle db, prismaAdapter(), drizzleAdapter(), or a SqlExecutor.",
  );
}
