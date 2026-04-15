import { type FlowPanelConfig, flowPanelConfigSchema } from "./config/schema";
import { validateConfig } from "./config/validate";
import { createQueryBuilder, type QueryBuilder } from "./queryBuilder";
import { createReaper } from "./reaper";
import { resolveResource } from "./resource/resolver";
import { serializeResource } from "./resource/serializer";
import type {
  ResourceAdapter,
  ResourceDescriptor,
  ResolvedResource,
  SerializedResource,
} from "./resource/types";
import type { SqlExecutor, SqlExecutorFactory } from "./types/db";
import { createWithRun } from "./withRun";

// ---------------------------------------------------------------------------
// Adapter detection helpers
// ---------------------------------------------------------------------------

interface AdapterResult {
  sql: SqlExecutor;
  resource?: ResourceAdapter;
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

function isSqlExecutor(input: unknown): input is SqlExecutor {
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

function detectAdapter(input: unknown): AdapterResult {
  // 1. Already a { sql, resource } adapter result (from prismaAdapter/drizzleAdapter)
  if (isAdapterResult(input)) {
    return input;
  }

  // 2. Direct SqlExecutor (existing pipeline-only usage)
  if (isSqlExecutor(input)) {
    return { sql: input };
  }

  // 3. SqlExecutorFactory function
  if (typeof input === "function") {
    // Wrap factory: return a lazy sql executor, no resource adapter
    return { sql: input as unknown as SqlExecutor };
  }

  // 4. PrismaClient — auto-wrap
  if (isPrismaClient(input)) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { prismaAdapter } = require("@flowpanel/adapter-prisma");
      return prismaAdapter({ prisma: input });
    } catch {
      throw new Error(
        "adapter: PrismaClient detected but @flowpanel/adapter-prisma is not installed. " +
          "Install it: pnpm add @flowpanel/adapter-prisma",
      );
    }
  }

  // 5. Drizzle db — auto-wrap
  if (isDrizzleDb(input)) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { drizzleAdapter } = require("@flowpanel/adapter-drizzle");
      return drizzleAdapter({ db: input });
    } catch {
      throw new Error(
        "adapter: Drizzle db detected but @flowpanel/adapter-drizzle is not installed. " +
          "Install it: pnpm add @flowpanel/adapter-drizzle",
      );
    }
  }

  throw new Error(
    "Unrecognized adapter. Pass a PrismaClient, Drizzle db, prismaAdapter(), drizzleAdapter(), or a SqlExecutor.",
  );
}

// ---------------------------------------------------------------------------
// Schema type
// ---------------------------------------------------------------------------

export interface FlowPanelSchema {
  appName: string;
  resources?: Record<string, SerializedResource>;
}

// ---------------------------------------------------------------------------
// FlowPanel interface
// ---------------------------------------------------------------------------

export interface FlowPanel<TConfig extends FlowPanelConfig = FlowPanelConfig> {
  config: TConfig;
  withRun<T>(
    stage: TConfig["pipeline"]["stages"][number],
    callback: (run: import("./withRun.js").RunHandle) => Promise<T>,
  ): Promise<T>;
  startReaper(options?: { interval?: string }): () => void;
  getDb(): Promise<SqlExecutor>;
  queryBuilder: QueryBuilder;

  // v2 resource fields
  resources?: Record<string, ResolvedResource>;
  resourceAdapter?: ResourceAdapter;
  getSchema(sessionRoles?: string[]): FlowPanelSchema;
}

// ---------------------------------------------------------------------------
// v2 config extensions (accepted alongside FlowPanelConfig)
// ---------------------------------------------------------------------------

export interface FlowPanelV2Extensions {
  /** Custom handler-level context (e.g. Stripe, Telegram clients). */
  context?: () => Promise<object> | object;
  /** Declared role names for access rules. */
  roles?: readonly string[];
  /** Row-level security for resources. */
  rowLevel?: (ctx: unknown) => object;
  /** Audit configuration for resources. */
  audit?: { enabled: boolean; retentionDays?: number };
  /** Resource definitions — object or builder function. */
  resources?:
    | Record<string, ResourceDescriptor>
    | ((fp: ResourceFactory) => Record<string, ResourceDescriptor>);
}

export interface ResourceFactory {
  resource(
    modelRef: unknown,
    opts?: import("./resource/types").ResourceOptions,
  ): ResourceDescriptor;
}

// ---------------------------------------------------------------------------
// resolveDb (unchanged)
// ---------------------------------------------------------------------------

async function resolveDb(factory: SqlExecutorFactory): Promise<SqlExecutor> {
  if (typeof factory === "function") return factory();
  return factory;
}

// ---------------------------------------------------------------------------
// Top-level `resource()` factory (exported for consumer use)
// ---------------------------------------------------------------------------

/**
 * Creates a ResourceDescriptor. Used in defineFlowPanel's `resources` config.
 *
 * @example
 * ```ts
 * import { resource } from "@flowpanel/core";
 * const users = resource("User", { label: "Users", icon: "users" });
 * ```
 */
export function resource(
  modelRef: unknown,
  opts?: import("./resource/types").ResourceOptions,
): ResourceDescriptor {
  return {
    __brand: "flowpanel.resource" as const,
    modelRef,
    opts: opts ?? {},
  };
}

// ---------------------------------------------------------------------------
// defineFlowPanel
// ---------------------------------------------------------------------------

/**
 * Define a FlowPanel pipeline dashboard.
 *
 * @example
 * ```ts
 * const flowpanel = defineFlowPanel({
 *   appName: "My App",
 *   adapter: prismaAdapter({ prisma }),
 *   pipeline: { stages: ["ingest", "process", "notify"] },
 *   security: { auth: { getSession } },
 * });
 * ```
 */
export function defineFlowPanel<TConfig extends FlowPanelConfig>(
  rawConfig: TConfig & FlowPanelV2Extensions,
): FlowPanel<TConfig> {
  // Extract v2 extensions before Zod validation (Zod doesn't know about them)
  const {
    context: _context,
    roles: _roles,
    rowLevel: _rowLevel,
    audit: _audit,
    resources: resourcesConfig,
    ...baseConfig
  } = rawConfig as TConfig & FlowPanelV2Extensions & Record<string, unknown>;

  // Validate with Zod (base config only)
  const parsed = flowPanelConfigSchema.safeParse(baseConfig);
  if (!parsed.success) {
    const messages = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`FlowPanel config validation failed:\n${messages}`);
  }

  const config = parsed.data as TConfig;

  // Semantic validation
  validateConfig(config);

  // Warn if getSession is still the init-generated stub
  const getSessionFn = config.security?.auth?.getSession;
  if (getSessionFn) {
    const fnStr = (getSessionFn as (...args: unknown[]) => unknown).toString();
    if (fnStr.includes("dev@localhost") || fnStr.includes("_flowpanelStub")) {
      console.warn(
        "[flowpanel] WARNING: getSession() is still the init-generated stub. " +
          "All requests will be unauthenticated. " +
          "Implement real authentication in flowpanel.config.ts → security.auth.getSession",
      );
    }
  }

  // ---- Adapter detection ---------------------------------------------------
  // Use rawConfig.adapter (pre-Zod) to preserve object identity
  const detected = detectAdapter(baseConfig.adapter);
  const sqlAdapter = detected.sql;
  const resourceAdapter = detected.resource;

  // ---- Resource processing -------------------------------------------------
  let resolvedResources: Record<string, ResolvedResource> | undefined;

  if (resourcesConfig) {
    if (!resourceAdapter) {
      throw new Error(
        "resources require a ResourceAdapter. Use prismaAdapter() or drizzleAdapter() " +
          "instead of a raw SqlExecutor.",
      );
    }

    // Resolve descriptors — support both object and function form
    const factory: ResourceFactory = {
      resource: (modelRef, opts) => ({
        __brand: "flowpanel.resource" as const,
        modelRef,
        opts: opts ?? {},
      }),
    };

    const descriptors =
      typeof resourcesConfig === "function" ? resourcesConfig(factory) : resourcesConfig;

    resolvedResources = {};
    for (const [key, descriptor] of Object.entries(descriptors)) {
      // Determine model name from adapter, modelRef (if string), or fall back to key
      const modelName =
        (
          resourceAdapter as ResourceAdapter & {
            getModelNameFromRef?: (ref: unknown) => string | undefined;
          }
        ).getModelNameFromRef?.(descriptor.modelRef) ??
        (typeof descriptor.modelRef === "string" ? descriptor.modelRef : key);
      const metadata = resourceAdapter.getModelMetadata(modelName);
      resolvedResources[key] = resolveResource(key, descriptor, metadata);
    }
  }

  // ---- Existing pipeline setup (unchanged) ---------------------------------
  const cwd = process.cwd();
  const redactionKeys = config.security?.redaction?.keys ?? [];

  // Lazy-resolved DB executor (singleton per defineFlowPanel call)
  let dbPromise: Promise<SqlExecutor> | null = null;
  function getDb(): Promise<SqlExecutor> {
    if (!dbPromise) {
      dbPromise = resolveDb(
        isSqlExecutor(sqlAdapter) ? sqlAdapter : (config.adapter as SqlExecutorFactory),
      );
    }
    return dbPromise;
  }

  const queryBuilder = createQueryBuilder({
    stages: config.pipeline.stages,
    stageFields: config.pipeline.stageFields ?? {},
    fields: config.pipeline.fields ?? {},
  });

  const withRunImpl = async <T>(
    stage: string,
    callback: (run: import("./withRun.js").RunHandle) => Promise<T>,
  ): Promise<T> => {
    const db = await getDb();
    const withRun = createWithRun({
      db,
      stageFields: config.pipeline.stageFields ?? {},
      stages: config.pipeline.stages,
      cwd,
      redactionKeys,
    });
    return withRun(stage, callback);
  };

  function startReaper(options?: { interval?: string }): () => void {
    const intervalStr = options?.interval ?? "60s";
    const match = intervalStr.match(/^(\d+)([smh])$/);
    const intervalMs = match
      ? parseInt(match[1] ?? "60", 10) *
        (match[2] === "s" ? 1000 : match[2] === "m" ? 60000 : 3600000)
      : 60000;

    const reaperThresholds: Record<string, string> = {};
    const configThresholds = config.pipeline.reaperThresholds ?? {};
    for (const stage of config.pipeline.stages) {
      reaperThresholds[stage] = configThresholds[stage] ?? "10m";
    }

    // Override sweep to lazily get db
    const stop = setInterval(async () => {
      const db = await getDb();
      const r = createReaper({ db, stages: config.pipeline.stages, reaperThresholds });
      r.sweep().catch((err) => console.error("[flowpanel] reaper error:", err));
    }, intervalMs);

    if (typeof (stop as unknown as { unref?: () => void }).unref === "function") {
      (stop as unknown as { unref: () => void }).unref();
    }
    return () => clearInterval(stop);
  }

  // ---- Schema getter -------------------------------------------------------
  function getSchema(sessionRoles: string[] = []): FlowPanelSchema {
    return {
      appName: config.appName,
      resources: resolvedResources
        ? Object.fromEntries(
            Object.entries(resolvedResources).map(([k, r]) => [
              k,
              serializeResource(r, sessionRoles),
            ]),
          )
        : undefined,
    };
  }

  return {
    config,
    withRun: withRunImpl as FlowPanel<TConfig>["withRun"],
    startReaper,
    getDb,
    queryBuilder,

    // v2 fields
    resources: resolvedResources,
    resourceAdapter,
    getSchema,
  };
}

// Re-export z for convenience: import { defineFlowPanel, z } from "@flowpanel/core"
export { z } from "zod";
