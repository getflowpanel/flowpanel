import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- Redis driver via mocked ioredis ---
const redisClient = {
  incr: vi.fn(async (_k: string) => 1),
  pexpire: vi.fn(async (_k: string, _ms: number) => 1),
};

vi.mock("ioredis", () => ({
  default: vi.fn(() => redisClient),
}));

import { createRateLimiter } from "../runtime/rate-limit.js";

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

  it("isolates buckets per key", async () => {
    const rl = createRateLimiter({ driver: "memory", limit: 1, windowMs: 60_000 });
    expect(await rl.check("alice")).toBe(true);
    expect(await rl.check("bob")).toBe(true);
    expect(await rl.check("alice")).toBe(false);
  });
});

describe("createRateLimiter — redis", () => {
  beforeEach(() => {
    redisClient.incr.mockClear();
    redisClient.pexpire.mockClear();
  });

  it("lazily imports ioredis (no calls before first check)", () => {
    createRateLimiter({
      driver: "redis",
      url: "redis://localhost:6379",
      limit: 5,
      windowMs: 60_000,
    });
    expect(redisClient.incr).not.toHaveBeenCalled();
  });

  it("calls INCR + PEXPIRE on first check for a key", async () => {
    const rl = createRateLimiter({
      driver: "redis",
      url: "redis://localhost:6379",
      limit: 3,
      windowMs: 60_000,
    });
    redisClient.incr.mockResolvedValueOnce(1);
    await rl.check("u:1");
    expect(redisClient.incr).toHaveBeenCalledWith("fp:rl:u:1");
    expect(redisClient.pexpire).toHaveBeenCalledWith("fp:rl:u:1", 60_000);
  });

  it("skips PEXPIRE on subsequent INCRs", async () => {
    const rl = createRateLimiter({
      driver: "redis",
      url: "redis://localhost:6379",
      limit: 3,
      windowMs: 60_000,
    });
    redisClient.incr.mockResolvedValueOnce(2);
    await rl.check("u:1");
    expect(redisClient.pexpire).not.toHaveBeenCalled();
  });

  it("returns false when count exceeds limit", async () => {
    const rl = createRateLimiter({
      driver: "redis",
      url: "redis://localhost:6379",
      limit: 3,
      windowMs: 60_000,
    });
    redisClient.incr.mockResolvedValueOnce(4);
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
    redisClient.incr.mockResolvedValueOnce(1);
    await rl.check("x");
    expect(redisClient.incr).toHaveBeenCalledWith("app:x");
  });
});
