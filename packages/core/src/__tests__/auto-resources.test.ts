import { describe, it, expect, afterEach, vi } from "vitest";
import { FlowPanelConfigError } from "../errors";
import { defineFlowPanel } from "../defineFlowPanel";

const baseConfig = {
  appName: "Test App",
  adapter: {
    execute: vi.fn(),
    transaction: vi.fn(),
    dialect: "postgres" as const,
  },
  pipeline: { stages: ["ingest"] },
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
