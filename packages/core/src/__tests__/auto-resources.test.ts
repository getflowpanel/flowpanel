import { afterEach, describe, expect, it, vi } from "vitest";
import type { FlowPanelAdapter } from "../config/adapter";
import { defineFlowPanel } from "../defineFlowPanel";
import { FlowPanelConfigError } from "../errors";

const stubAdapter: FlowPanelAdapter = {
  execute: vi.fn(),
  transaction: vi.fn(),
  dialect: "postgres",
  // biome-ignore lint/suspicious/noExplicitAny: partial stub — full SqlExecutor methods unused in this suite
} as any;

const baseConfig = {
  appName: "Test App",
  timezone: "UTC",
  basePath: "/admin",
  adapter: stubAdapter,
  pipeline: { stages: ["ingest"], fields: {}, stageFields: {} },
  security: { auth: { getSession: async () => null } },
};

describe('resources: "auto" production guard', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws FlowPanelConfigError in production when resources is auto", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() =>
      defineFlowPanel({
        ...baseConfig,
        resources: "auto",
      }),
    ).toThrow(FlowPanelConfigError);
  });

  it("thrown error contains helpful message", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() =>
      defineFlowPanel({
        ...baseConfig,
        resources: "auto",
      }),
    ).toThrow(/resources: "auto" is not allowed in production/);
  });

  it("does not throw in production when unsafeAllowAutoResourcesInProduction is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    // Should not throw FlowPanelConfigError (may throw for other adapter reasons, but not the guard)
    expect(() =>
      defineFlowPanel({
        ...baseConfig,
        resources: "auto",
        unsafeAllowAutoResourcesInProduction: true,
      }),
    ).not.toThrow(FlowPanelConfigError);
  });

  it("does not throw in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(() =>
      defineFlowPanel({
        ...baseConfig,
        resources: "auto",
      }),
    ).not.toThrow(FlowPanelConfigError);
  });
});
