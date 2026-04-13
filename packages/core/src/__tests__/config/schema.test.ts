import { describe, expect, it } from "vitest";
import { z } from "zod";
import { flowPanelConfigSchema } from "../../config/schema";

const adapter = {
  execute: async () => [],
  transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
  dialect: "postgres" as const,
};

const minimalConfig = {
  appName: "test",
  timezone: "UTC",
  basePath: "/admin",
  adapter: adapter,
  pipeline: {
    stages: ["parse", "score"],
    fields: { userId: z.string().nullable() },
    stageFields: {
      parse: { source: z.string() },
      score: { tokensIn: z.number().int() },
    },
  },
  security: {
    auth: {
      getSession: async (_req: Request) => null,
    },
  },
};

describe("flowPanelConfigSchema", () => {
  it("accepts minimal valid config", () => {
    const result = flowPanelConfigSchema.safeParse(minimalConfig);
    expect(result.success).toBe(true);
  });

  it("rejects config without getSession", () => {
    const bad = { ...minimalConfig, security: { auth: {} } };
    const result = flowPanelConfigSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects duplicate stage names", () => {
    const bad = {
      ...minimalConfig,
      pipeline: { ...minimalConfig.pipeline, stages: ["parse", "parse"] },
    };
    const result = flowPanelConfigSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("accepts valid IANA timezone", () => {
    const result = flowPanelConfigSchema.safeParse({
      ...minimalConfig,
      timezone: "America/New_York",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid timezone", () => {
    const result = flowPanelConfigSchema.safeParse({
      ...minimalConfig,
      timezone: "NotATimezone",
    });
    expect(result.success).toBe(false);
  });

  it("rejects stage name with SQL injection characters", () => {
    const bad = {
      ...minimalConfig,
      pipeline: { ...minimalConfig.pipeline, stages: ["ingest'; DROP TABLE"] },
    };
    const result = flowPanelConfigSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects users.source with SQL injection characters", () => {
    const bad = {
      ...minimalConfig,
      users: {
        source: "users; DROP TABLE",
        primaryKey: "id",
      },
    };
    const result = flowPanelConfigSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});
