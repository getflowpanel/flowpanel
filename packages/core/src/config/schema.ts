import { z } from "zod";

const intervalSchema = z.string().regex(/^\d+[smh]$/, "Must be like '10m', '5s', '2h'");

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

const fieldMapSchema = z.record(z.any());
const stageFieldMapSchema = z.record(fieldMapSchema);

const runLogColumnSchema = z.object({
  field: z.string(),
  label: z.string(),
  width: z.number().optional(),
  flex: z.number().optional(),
  mono: z.boolean().optional(),
  format: z
    .enum(["number", "currency-usd", "currency-usd-micro", "duration", "date-relative", "date"])
    .optional(),
  render: z.string().optional(),
});

export const flowPanelConfigSchema = z.object({
  appName: z.string().min(1),
  timezone: timezoneSchema.default("UTC"),
  basePath: z.string().startsWith("/").default("/admin"),

  adapter: z.union([
    z
      .object({
        execute: z.function(),
        transaction: z.function(),
      })
      .passthrough(),
    z.function(), // factory: () => Promise<SqlExecutor>
  ]),

  pipeline: z.object({
    stages: z
      .array(z.string())
      .min(1)
      .refine((stages) => new Set(stages).size === stages.length, {
        message: "Stage names must be unique",
      }),
    fields: fieldMapSchema.default({}),
    stageFields: stageFieldMapSchema.default({}),
    stageColors: z.record(z.string()).optional(),
    aiCostStages: z
      .record(
        z.object({
          costField: z.string(),
          tokensIn: z.string(),
          tokensOut: z.string(),
          model: z.string(),
        }),
      )
      .optional(),
    onRetry: z.function().optional(),
    indexes: z.array(z.array(z.string())).optional(),
    reaperThresholds: z.record(intervalSchema).optional(),
  }),

  metrics: z
    .record(
      z.object({
        label: z.string(),
        query: z.any(),
        format: z.enum(["number", "percent", "currency-usd", "duration"]),
        trend: z.literal("vs-previous-period").optional(),
        sublabel: z.function().optional(),
        drawer: z.string().optional(),
        refreshInterval: intervalSchema.optional(),
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
            type: z.enum([
              "trend-chart",
              "stat-grid",
              "breakdown",
              "error-list",
              "kv-grid",
              "error-block",
              "timeline",
            ]),
            field: z.string().optional(),
            groupBy: z.string().optional(),
            stats: z.array(z.string()).optional(),
            fields: z.array(z.string()).optional(),
            limit: z.number().optional(),
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
      source: z.string(),
      primaryKey: z.string(),
      periodStart: z.string().optional(),
      periodEnd: z.string().optional(),
      columns: z.array(runLogColumnSchema).optional(),
    })
    .optional(),

  security: z.object({
    auth: z.object({
      getSession: z.function().refine((fn) => typeof fn === "function", {
        message: "getSession is required and must be a function",
      }),
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
    rowLevel: z.object({ filter: z.function() }).optional(),
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
      css: z.string().optional(),
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
