import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- Redis driver via mocked ioredis ---
const redisClient = {
  eval: vi.fn(
    async (_script: string, _keys: number, _k: string, _ms: number): Promise<unknown> => 1,
  ),
};

vi.mock("ioredis", () => ({
  default: vi.fn(function Redis() {
    return redisClient;
  }),
}));

import { createRateLimiter, MEMORY_LIMITER_MAX_KEYS } from "../runtime/rate-limit";

describe("createRateLimiter — memory", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to `limit` checks within `windowMs`, then denies", async () => {
    const rl = createRateLimiter({ driver: "memory", limit: 3, windowMs: 60_000 });
    expect(await rl.check("k")).toBe(true);
    expect(await rl.check("k")).toBe(true);
    expect(await rl.check("k")).toBe(true);
    expect(await rl.check("k")).toBe(false);
  });

  it("resets the bucket after the window elapses", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const rl = createRateLimiter({ driver: "memory", limit: 1, windowMs: 1_000 });
    expect(await rl.check("k")).toBe(true);
    expect(await rl.check("k")).toBe(false);
    vi.setSystemTime(1_500);
    expect(await rl.check("k")).toBe(true);
  });

  it("caps how many keys it holds by dropping the oldest buckets", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const rl = createRateLimiter({ driver: "memory", limit: 1, windowMs: 1_000 });
    expect(await rl.check("victim")).toBe(true);
    for (let i = 0; i < MEMORY_LIMITER_MAX_KEYS * 2; i++) await rl.check(`forged-${i}`);
    expect(await rl.check("victim")).toBe(true);
    vi.setSystemTime(500);
    expect(await rl.check("victim")).toBe(false);
  });

  it("isolates buckets per key", async () => {
    const rl = createRateLimiter({ driver: "memory", limit: 1, windowMs: 60_000 });
    expect(await rl.check("alice")).toBe(true);
    expect(await rl.check("bob")).toBe(true);
    expect(await rl.check("alice")).toBe(false);
  });
});

describe("createRateLimiter — redis", () => {
  beforeEach(() => {
    redisClient.eval.mockClear();
  });

  it("lazily imports ioredis (no calls before first check)", () => {
    createRateLimiter({
      driver: "redis",
      url: "redis://localhost:6379",
      limit: 5,
      windowMs: 60_000,
    });
    expect(redisClient.eval).not.toHaveBeenCalled();
  });

  it("counts and sets the expiry in one atomic script", async () => {
    const rl = createRateLimiter({
      driver: "redis",
      url: "redis://localhost:6379",
      limit: 3,
      windowMs: 60_000,
    });
    redisClient.eval.mockResolvedValueOnce(1);
    expect(await rl.check("u:1")).toBe(true);
    expect(redisClient.eval).toHaveBeenCalledOnce();
    const [script, keys, key, ms] = redisClient.eval.mock.calls[0] ?? [];
    expect(script).toMatch(/INCR[\s\S]*PEXPIRE/);
    expect([keys, key, ms]).toEqual([1, "fp:rl:u:1", 60_000]);
  });

  it("returns false when count exceeds limit", async () => {
    const rl = createRateLimiter({
      driver: "redis",
      url: "redis://localhost:6379",
      limit: 3,
      windowMs: 60_000,
    });
    redisClient.eval.mockResolvedValueOnce(4);
    expect(await rl.check("u:1")).toBe(false);
  });

  it("respects keyPrefix override", async () => {
    const rl = createRateLimiter({
      driver: "redis",
      url: "redis://localhost:6379",
      limit: 3,
      windowMs: 60_000,
      keyPrefix: "app:",
    });
    await rl.check("x");
    expect(redisClient.eval.mock.calls[0]?.[2]).toBe("app:x");
  });
});
