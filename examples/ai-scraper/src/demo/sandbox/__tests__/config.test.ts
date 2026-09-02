import { describe, expect, it } from "vitest";
import { isEnabledFlag, readSandboxConfig } from "../config";

describe("demo sandbox configuration", () => {
  it("uses safe local defaults", () => {
    expect(readSandboxConfig({})).toMatchObject({
      publicMode: false,
      readOnly: false,
      secret: null,
      maxActive: 200,
      maxCreatesPerHour: 10,
      inactivityMs: 60 * 60_000,
      absoluteMs: 24 * 60 * 60_000,
      touchIntervalMs: 5 * 60_000,
      cleanupIntervalMs: 15 * 60_000,
    });
  });

  it("requires a strong secret in public mode", () => {
    expect(() => readSandboxConfig({ DEMO_MODE: "true" })).toThrow(/32 characters/);
    expect(() => readSandboxConfig({ DEMO_MODE: "true", DEMO_SANDBOX_SECRET: "short" })).toThrow(
      /32 characters/,
    );
  });

  it("accepts bounded integer overrides and the emergency read-only switch", () => {
    expect(
      readSandboxConfig({
        DEMO_MODE: "true",
        DEMO_READ_ONLY: "true",
        DEMO_SANDBOX_SECRET: "x".repeat(32),
        DEMO_SANDBOX_MAX_ACTIVE: "350",
        DEMO_SANDBOX_MAX_CREATES_PER_HOUR: "15",
      }),
    ).toMatchObject({ readOnly: true, maxActive: 350, maxCreatesPerHour: 15 });
  });

  it("uses one boolean parser for runtime and presentation flags", () => {
    expect(isEnabledFlag("true")).toBe(true);
    expect(isEnabledFlag("1")).toBe(true);
    expect(isEnabledFlag("TRUE")).toBe(false);
    expect(isEnabledFlag(undefined)).toBe(false);
  });

  it("trusts proxy forwarding headers only after an explicit opt-in", () => {
    expect(readSandboxConfig({}).trustProxy).toBe(false);
    expect(readSandboxConfig({ DEMO_TRUST_PROXY: "true" }).trustProxy).toBe(true);
  });

  it.each(["0", "-1", "1.5", "NaN", "10001"])("rejects unsafe max-active override %s", (value) => {
    expect(() => readSandboxConfig({ DEMO_SANDBOX_MAX_ACTIVE: value })).toThrow(/positive integer/);
  });
});
