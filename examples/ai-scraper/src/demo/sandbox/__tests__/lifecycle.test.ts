import { describe, expect, it } from "vitest";
import { readSandboxConfig } from "../config";
import {
  assertCreationAllowed,
  canReset,
  nextDeadlines,
  SandboxCapacityError,
  SandboxCreationRateLimitError,
  shouldTouch,
} from "../lifecycle";

const config = readSandboxConfig({});

describe("sandbox lifecycle decisions", () => {
  it("computes exact inactivity and absolute deadlines", () => {
    const createdAt = new Date("2026-08-30T00:00:00.000Z");
    const now = new Date("2026-08-30T01:00:00.000Z");
    expect(nextDeadlines(createdAt, now, config)).toEqual({
      inactivityExpiresAt: new Date("2026-08-30T02:00:00.000Z"),
      absoluteExpiresAt: new Date("2026-08-31T00:00:00.000Z"),
    });
  });

  it("coalesces activity writes at the exact five-minute boundary", () => {
    const lastSeenAt = new Date("2026-08-30T00:00:00.000Z");
    expect(shouldTouch(lastSeenAt, new Date(lastSeenAt.getTime() + 299_999), config)).toBe(false);
    expect(shouldTouch(lastSeenAt, new Date(lastSeenAt.getTime() + 300_000), config)).toBe(true);
  });

  it("enforces the reset cooldown at its exact boundary", () => {
    const lastResetAt = new Date("2026-08-30T00:00:00.000Z");
    expect(canReset(lastResetAt, new Date(lastResetAt.getTime() + 4_999))).toBe(false);
    expect(canReset(lastResetAt, new Date(lastResetAt.getTime() + 5_000))).toBe(true);
    expect(canReset(null, lastResetAt)).toBe(true);
  });

  it("rejects capacity and fingerprint limits at their exact boundaries", () => {
    expect(() =>
      assertCreationAllowed({ active: 199, recentForFingerprint: 9, config }),
    ).not.toThrow();
    expect(() => assertCreationAllowed({ active: 200, recentForFingerprint: 0, config })).toThrow(
      SandboxCapacityError,
    );
    expect(() => assertCreationAllowed({ active: 0, recentForFingerprint: 10, config })).toThrow(
      SandboxCreationRateLimitError,
    );
  });
});
