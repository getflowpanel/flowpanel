import { type FlowPanelConfig, flowPanelConfigSchema } from "./config/schema";
import { fromZodError } from "./errors/fromZod";
import { validateConfig } from "./config/validate";
import { FlowPanelConfigError } from "./errors";
import { resolvePages, serializePages } from "./pages/resolver";
import type { FlowPanelPage, ResolvedPage, SerializedPage } from "./pages/types";
import { createQueryBuilder, type QueryBuilder } from "./queryBuilder";
import { resolveQueues, serializeQueues } from "./queue/resolver";
import type { QueueAdapter, ResolvedQueue, SerializedQueue } from "./queue/types";
import { createReaper } from "./reaper";
import { isTypedResourceDefinition, lowerTypedResource } from "./resource/lowerTyped";
import { resolveResource } from "./resource/resolver";
import { serializeResource } from "./resource/serializer";
import type { TypedResourceDefinition } from "./resource/typedTypes";
import type {
  ResolvedResource,
  ResourceAdapter,
  ResourceDescriptor,
  SerializedResource,
} from "./resource/types";
import type { SqlExecutor, SqlExecutorFactory } from "./types/db";
import { resolveDashboard as resolveDashboardFn } from "./widget/builder";
import { serializeDashboard } from "./widget/serializer";
import { createWithRun } from "./withRun";

// ---------------------------------------------------------------------------
// Adapter detection helpers
// ---------------------------------------------------------------------------

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

  // 5. Drizzle db — auto-wrap
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

// ---------------------------------------------------------------------------
// Schema type
// ---------------------------------------------------------------------------

export interface FlowPanelSchema {
  appName: string;
  resources?: Record<string, SerializedResource>;
  dashboard?: import("./widget/types").SerializedWidget[];
  queues?: Record<string, SerializedQueue>;
  pages?: SerializedPage[];
}

// ---------------------------------------------------------------------------
// FlowPanel interface
// ---------------------------------------------------------------------------

/** The shape expected by createFlowPanelRouter's `config` parameter. */
export interface FlowPanelRouterConfig {
  config: FlowPanelConfig;
  getDb: () => Promise<SqlExecutor>;
  resources?: Record<string, ResolvedResource>;
  resourceAdapter?: ResourceAdapter;
  dashboard?: import("./widget/types").ResolvedWidget[];
  queues?: Record<string, ResolvedQueue>;
}

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
  dashboard?: import("./widget/types").ResolvedWidget[];
  queues?: Record<string, ResolvedQueue>;
  pages?: ResolvedPage[];
  getSchema(sessionRoles?: string[]): FlowPanelSchema;

  /** Returns the config object needed by createFlowPanelRouter. */
  getRouterConfig(): FlowPanelRouterConfig;
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
  /** Resource definitions — object, builder function, or "auto" (dev-only). */
  // biome-ignore lint/suspicious/noExplicitAny: TypedResourceDefinition<TRow> is contravariant in TRow via action handlers; `any` is the standard widening for union-accepting options.
  resources?:
    | Record<string, ResourceDescriptor | TypedResourceDefinition<any>>
    // biome-ignore lint/suspicious/noExplicitAny: see above
    | ((fp: ResourceFactory) => Record<string, ResourceDescriptor | TypedResourceDefinition<any>>)
    | "auto";
  /** Allow resources: "auto" in production. Understand the risk before using. */
  unsafeAllowAutoResourcesInProduction?: boolean;
  /** Dashboard widgets — array or builder function. */
  dashboard?: import("./widget/types").DashboardConfig;
  /** Queue adapters keyed by id. Each shows up as its own tab in the admin. */
  queues?: Record<string, QueueAdapter>;
  /**
   * Custom pages — React components rendered inside the admin shell at
   * `/admin/<path>`. Use for reports, settings, wizards, anything that isn't
   * a CRUD resource or queue.
   *
   * @example
   *   pages: [
   *     { path: "reports", component: ReportsPage, icon: "bar-chart-3" },
   *     { path: "settings", component: SettingsPage, access: ["admin"] },
   *   ]
   */
  pages?: readonly FlowPanelPage[];
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
    dashboard: dashboardConfig,
    queues: queuesConfig,
    pages: pagesConfig,
    unsafeAllowAutoResourcesInProduction,
    ...baseConfig
  } = rawConfig as TConfig & FlowPanelV2Extensions & Record<string, unknown>;

  // Validate with Zod (base config only). Raw ZodError is unfriendly — wrap
  // via fromZodError to get code frames, Did-you-mean, and docs links where
  // applicable.
  const parsed = flowPanelConfigSchema.safeParse(baseConfig);
  if (!parsed.success) {
    throw fromZodError(parsed.error, {
      received: baseConfig,
      docs: "https://flowpanel.dev/docs/reference/config",
    });
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

  if (resourcesConfig === "auto") {
    if (process.env.NODE_ENV === "production" && !unsafeAllowAutoResourcesInProduction) {
      throw new FlowPanelConfigError(
        'resources: "auto" is not allowed in production. ' +
          "It exposes every database model to the admin, including sensitive tables. " +
          "Declare resources explicitly, or pass unsafeAllowAutoResourcesInProduction: true if you understand the risk.",
      );
    }
    console.warn(
      '[FlowPanel] resources: "auto" detected — all database models will be exposed. ' +
        "Run `flowpanel doctor` to review. Not recommended for production.",
    );
  } else if (resourcesConfig) {
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
    for (const [key, raw] of Object.entries(descriptors)) {
      if (isTypedResourceDefinition(raw)) {
        // New typed builder (defineResource) output — bypass descriptor pipeline.
        resolvedResources[key] = lowerTypedResource(key, raw as TypedResourceDefinition);
        continue;
      }
      const descriptor = raw as ResourceDescriptor;
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

  // ---- Dashboard resolution ------------------------------------------------
  const resolvedDashboard: import("./widget/types").ResolvedWidget[] | undefined = dashboardConfig
    ? resolveDashboardFn(dashboardConfig as import("./widget/types").DashboardConfig)
    : undefined;

  // ---- Queue resolution ----------------------------------------------------
  const resolvedQueuesMap = queuesConfig
    ? resolveQueues(queuesConfig as Record<string, QueueAdapter>)
    : undefined;

  // ---- Pages resolution ----------------------------------------------------
  const resolvedPages: ResolvedPage[] | undefined = pagesConfig
    ? resolvePages(pagesConfig as readonly FlowPanelPage[], {
        resourceIds: resolvedResources ? Object.keys(resolvedResources) : [],
        queueIds: resolvedQueuesMap ? Object.keys(resolvedQueuesMap) : [],
      })
    : undefined;

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
      dashboard: resolvedDashboard ? serializeDashboard(resolvedDashboard) : undefined,
      queues: resolvedQueuesMap ? serializeQueues(resolvedQueuesMap) : undefined,
      pages: resolvedPages ? serializePages(resolvedPages, sessionRoles) : undefined,
    };
  }

  function getRouterConfig(): FlowPanelRouterConfig {
    return {
      config,
      getDb,
      resources: resolvedResources,
      resourceAdapter,
      dashboard: resolvedDashboard,
      queues: resolvedQueuesMap,
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
    dashboard: resolvedDashboard,
    queues: resolvedQueuesMap,
    pages: resolvedPages,
    getSchema,
    getRouterConfig,
  };
}

// Re-export z for convenience: import { defineFlowPanel, z } from "@flowpanel/core"
export { z } from "zod";
