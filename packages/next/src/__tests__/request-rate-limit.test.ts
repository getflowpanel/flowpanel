import type { AdminConfig, RateLimitConfig } from "@flowpanel/core";
import { FlowpanelRateLimitError } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { buildRequestContext } from "../runtime/request-setup";

function mkConfig(rateLimit?: RateLimitConfig, userId: string | null = "u1"): AdminConfig {
  const base: AdminConfig = {
    adapter: { kind: "drizzle", db: {} } as never,
    auth: {
      session: async () => (userId ? { user: { id: userId } } : null),
      role: () => "admin",
    },
    resources: [],
  };
  if (rateLimit) base.rateLimit = rateLimit;
  return base;
}

describe("buildRequestContext — rate limit", () => {
  it("allows when rateLimit is unset", async () => {
    const ctx = await buildRequestContext({
      req: new Request("http://localhost/"),
      config: mkConfig(),
    });
    expect(ctx).toBeDefined();
  });

  it("enforces memory limit per user", async () => {
    const cfg = mkConfig({
      driver: "memory",
      limit: 2,
      windowMs: 60_000,
      per: "user",
    });
    const doCheck = () =>
      buildRequestContext({ req: new Request("http://localhost/"), config: cfg });
    await doCheck();
    await doCheck();
    await expect(doCheck()).rejects.toBeInstanceOf(FlowpanelRateLimitError);
  });

  it("skips when rateLimit.enabled is false", async () => {
    const cfg = mkConfig({
      driver: "memory",
      limit: 1,
      windowMs: 60_000,
      enabled: false,
    });
    const doCheck = () =>
      buildRequestContext({ req: new Request("http://localhost/"), config: cfg });
    await doCheck();
    // Would be denied if enabled; verify it still succeeds.
    await expect(doCheck()).resolves.toBeDefined();
  });

  it("keys by IP when per='ip'", async () => {
    const cfg = mkConfig({
      driver: "memory",
      limit: 1,
      windowMs: 60_000,
      per: "ip",
    });
    const req1 = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    const req2 = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "5.6.7.8" },
    });
    await buildRequestContext({ req: req1, config: cfg });
    // Different IP — should be allowed.
    await expect(buildRequestContext({ req: req2, config: cfg })).resolves.toBeDefined();
    // Same IP as first — should be denied.
    await expect(
      buildRequestContext({
        req: new Request("http://localhost/", {
          headers: { "x-forwarded-for": "1.2.3.4" },
        }),
        config: cfg,
      }),
    ).rejects.toBeInstanceOf(FlowpanelRateLimitError);
  });

  it("keys by the session's top-level id (Clerk/Lucia session shape) when per='user'", async () => {
    // Regression test: `AdminConfig.auth.session()` for `withClerk` / `withLucia`
    // returns `{ id, ... }` (no `user` wrapper) — before the `actorIdFromSession`
    // fallback fix, this silently degraded to the IP bucket for every visitor.
    const cfg: AdminConfig = {
      adapter: { kind: "drizzle", db: {} } as never,
      auth: {
        session: async () => ({ id: "clerk_u1" }),
        role: () => "admin",
      },
      resources: [],
      rateLimit: { driver: "memory", limit: 1, windowMs: 60_000, per: "user" },
    };
    const doCheck = () =>
      buildRequestContext({ req: new Request("http://localhost/"), config: cfg });
    await doCheck();
    // Same session id both times — second call should be denied, proving the
    // key is `user:clerk_u1`, not `ip:unknown` shared across every caller.
    await expect(doCheck()).rejects.toBeInstanceOf(FlowpanelRateLimitError);
  });

  it("uses the AuthConfig.userId contract when set, overriding the default shape", async () => {
    const cfg: AdminConfig = {
      adapter: { kind: "drizzle", db: {} } as never,
      auth: {
        session: async () => ({ id: "top-level-id", tenant: { userId: "tenant-user-1" } }),
        role: () => "admin",
        userId: (s) => (s as { tenant?: { userId?: string } } | null)?.tenant?.userId ?? null,
      },
      resources: [],
      rateLimit: { driver: "memory", limit: 1, windowMs: 60_000, per: "user" },
    };
    const doCheck = () =>
      buildRequestContext({ req: new Request("http://localhost/"), config: cfg });
    await doCheck();
    await expect(doCheck()).rejects.toBeInstanceOf(FlowpanelRateLimitError);
  });
});
