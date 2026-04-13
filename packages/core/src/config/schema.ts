import { z } from "zod";

const intervalSchema = z.string().regex(/^\d+[smh]$/, "Must be like '10m', '5s', '2h'");

export const sqlIdentifier = z
  .string()
  .regex(
    /^[a-zA-Z_][a-zA-Z0-9_]*$/,
    "Must be a valid SQL identifier (letters, digits, underscores)",
  );

const timezoneSchema = z
  .string()
  .min(1)
  .refine(
    (tz) => {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    },
    { message: "Invalid IANA timezone. Example: 'UTC', 'America/New_York'" },
  );

/**
 * Map of field names to their Zod schemas.
 * Values must be Zod types (e.g., z.string(), z.number()) but are typed as z.any()
 * because Zod schemas cannot validate other Zod schemas at the type level.
 */
const fieldMapSchema = z.record(z.any());
const stageFieldMapSchema = z.record(fieldMapSchema);

const runLogColumnSchema = z.object({
  field: sqlIdentifier,
  label: z.string(),
  width: z.number().optional(),
  flex: z.number().optional(),
  mono: z.boolean().optional(),
  /** Display format: "number" | "currency-usd" | "currency-usd-micro" | "duration" | "date-relative" | "date" */
  format: z
    .enum(["number", "currency-usd", "currency-usd-micro", "duration", "date-relative", "date"])
    .optional(),
  /** Built-in component name ("stagePill", "statusTag") or custom component registered via UI */
  render: z.string().optional(),
});

export const flowPanelConfigSchema = z.object({
  appName: z.string().min(1).describe("Display name shown in the dashboard header"),
  timezone: timezoneSchema
    .default("UTC")
    .describe("IANA timezone for date display. Example: 'America/New_York'"),
  basePath: z.string().startsWith("/").default("/admin"),

  adapter: z
    .union([
      z
        .object({
          execute: z.function(),
          transaction: z.function(),
          dialect: z.enum(["postgres"]),
        })
        .passthrough(),
      z.function(),
    ])
    .describe("Database adapter — use drizzleAdapter() or prismaAdapter()"),

  pipeline: z.object({
    stages: z
      .array(sqlIdentifier)
      .min(1)
      .refine((stages) => new Set(stages).size === stages.length, {
        message: "Stage names must be unique",
      })
      .describe("Pipeline stages in execution order"),
    /** Global fields tracked on every run (e.g. userId, source) */
    fields: fieldMapSchema.default({}).describe("Global fields tracked on every run"),
    /** Per-stage fields, accessed via run.set() inside withRun callback */
    stageFields: stageFieldMapSchema
      .default({})
      .describe("Per-stage fields, set via run.set() in withRun callback"),
    stageColors: z.record(z.string()).optional(),
    /** Enables AI cost tracking (tokens, model, cost) for specific stages */
    aiCostStages: z
      .record(
        z.object({
          costField: sqlIdentifier,
          tokensIn: sqlIdentifier,
          tokensOut: sqlIdentifier,
          model: sqlIdentifier,
        }),
      )
      .optional(),
    /** Called when an admin clicks Retry in the dashboard for a failed run */
    onRetry: z.function().optional(),
    indexes: z.array(z.array(z.string())).optional(),
    /** Per-stage timeout: runs still "running" after this duration are marked failed */
    reaperThresholds: z.record(intervalSchema).optional(),
  }),

  /** Each key becomes a metric card on the dashboard (e.g. "totalRuns", "errorRate") */
  metrics: z
    .record(
      z.object({
        label: z.string(),
        /** Raw query parameters passed to the adapter. Typed as record since shape depends on the adapter. */
        query: z.record(z.unknown()),
        format: z.enum(["number", "percent", "currency-usd", "duration"]),
        trend: z.literal("vs-previous-period").optional(),
        sublabel: z.function().optional(),
        drawer: z.string().optional(),
        refreshInterval: intervalSchema
          .optional()
          .describe("Auto-refresh interval. Examples: '5s', '30s', '2m'"),
      }),
    )
    .optional(),

  runLog: z
    .object({
      columns: z.array(runLogColumnSchema).optional(),
      filters: z.array(z.string()).optional(),
      bulkActions: z.array(z.string()).optional(),
      rowClick: z.string().optional(),
      pagination: z
        .object({
          mode: z.enum(["cursor", "offset"]),
          pageSize: z.number().positive(),
        })
        .optional(),
      search: z
        .object({
          fields: z.array(z.string()),
          debounceMs: z.number().positive(),
          minLength: z.number().positive(),
        })
        .optional(),
    })
    .optional(),

  timeRange: z
    .object({
      default: z.string(),
      presets: z.array(z.string()).optional(),
      allowCustom: z.boolean().optional(),
      persist: z.enum(["session", "none"]).optional(),
    })
    .optional(),

  drawers: z
    .record(
      z.object({
        title: z.union([z.string(), z.function()]),
        sections: z.array(
          z.object({
            /** Built-in section type: "trend-chart" | "stat-grid" | "breakdown" | "error-list" | "kv-grid" | "error-block" | "timeline" */
            type: z.enum([
              "trend-chart",
              "stat-grid",
              "breakdown",
              "error-list",
              "kv-grid",
              "error-block",
              "timeline",
            ]),
            field: sqlIdentifier.optional(),
            groupBy: sqlIdentifier.optional(),
            stats: z.array(z.string()).optional(),
            fields: z.array(z.string()).optional(),
            limit: z.number().optional(),
            /** Controls section visibility; receives the run object, return false to hide */
            when: z.function().optional(),
          }),
        ),
        actions: z
          .array(
            z.object({
              label: z.string(),
              onClick: z.string(),
              variant: z.enum(["default", "danger"]).optional(),
              when: z.function().optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),

  tabs: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        icon: z.string(),
        view: z.string(),
        component: z.function().optional(),
      }),
    )
    .optional(),

  users: z
    .object({
      source: sqlIdentifier,
      primaryKey: sqlIdentifier,
      periodStart: z.string().optional(),
      periodEnd: z.string().optional(),
      columns: z.array(runLogColumnSchema).optional(),
    })
    .optional(),

  security: z.object({
    auth: z.object({
      getSession: z
        .function()
        .refine((fn) => typeof fn === "function", {
          message: "getSession is required and must be a function",
        })
        .describe("Async function that returns the current user session from a request"),
      requireRole: z.string().optional(),
      sessionMaxAge: intervalSchema.optional(),
      stepUpForDestructive: z.boolean().optional(),
      stepUpVerify: z.function().optional(),
    }),
    permissions: z
      .record(
        z.object({
          read: z.array(z.string()),
          write: z.array(z.string()),
        }),
      )
      .optional(),
    /** Row-level security: filter receives user session and returns a WHERE clause for multi-tenant isolation */
    rowLevel: z.object({ filter: z.function() }).optional(),
    /** Per-endpoint rate limits keyed by tRPC procedure name */
    rateLimits: z
      .record(
        z.object({
          perMinute: z.number().optional(),
          perHour: z.number().optional(),
          allowInMemoryInProd: z.boolean().optional(),
        }),
      )
      .optional(),
    auditLog: z.object({ retentionDays: z.number() }).optional(),
    redaction: z.object({ keys: z.array(z.string()) }).optional(),
  }),

  ui: z
    .object({
      locale: z.string().optional(),
      translations: z.record(z.string()).optional(),
      commands: z
        .array(
          z.object({
            id: z.string(),
            label: z.string(),
            action: z.function(),
          }),
        )
        .optional(),
      /** SSE (Server-Sent Events) live-update configuration */
      stream: z
        .object({
          maxConnections: z.number().optional(),
          heartbeatInterval: intervalSchema.optional(),
          replayWindow: intervalSchema.optional(),
          fallbackPollingInterval: intervalSchema.optional(),
        })
        .optional(),
    })
    .optional(),

  theme: z
    .object({
      accent: z.string().optional(),
      radius: z.string().optional(),
      fontSans: z.string().optional(),
      fontMono: z.string().optional(),
      /** Raw CSS injected into the panel container (scoped to .flowpanel-root) */
      css: z.string().optional(),
      colorScheme: z.enum(["dark", "light", "auto"]).default("auto"),
    })
    .optional(),

  retention: z
    .object({
      hotRunsHours: z.number().min(0).optional(),
      aggregateDaily: z.boolean().optional(),
    })
    .optional(),
});

export type FlowPanelConfigInput = z.input<typeof flowPanelConfigSchema>;
export type FlowPanelConfig = z.output<typeof flowPanelConfigSchema>;
