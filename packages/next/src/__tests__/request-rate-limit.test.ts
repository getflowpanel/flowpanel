import type { AdminDefinition, RateLimitConfig } from "@flowpanel/core";
import { FlowpanelRateLimitError } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { buildRequestContext } from "../runtime/request-setup";

function mkConfig(rateLimit?: RateLimitConfig, userId: string | null = "u1"): AdminDefinition {
  const base: AdminDefinition = {
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
    cfg.security = { trustedProxies: 1 };
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

  it("SECURITY: a forged X-Forwarded-For entry does not buy a fresh bucket", async () => {
    const cfg = mkConfig({ driver: "memory", limit: 1, windowMs: 60_000, per: "ip" });
    cfg.security = { trustedProxies: 1 };
    const from = (forged: string) =>
      buildRequestContext({
        req: new Request("http://localhost/", {
          headers: { "x-forwarded-for": `${forged}, 203.0.113.7` },
        }),
        config: cfg,
      });
    await expect(from("1.1.1.1")).resolves.toMatchObject({ ip: "203.0.113.7" });
    await expect(from("2.2.2.2")).rejects.toBeInstanceOf(FlowpanelRateLimitError);
  });

  it("trusts no X-Forwarded-For header unless trustedProxies is set", async () => {
    const ctx = await buildRequestContext({
      req: new Request("http://localhost/", { headers: { "x-forwarded-for": "1.2.3.4" } }),
      config: mkConfig(),
    });
    expect(ctx.ip).toBeNull();
  });

  it("keys per: ip by the user id when the IP is unknown, never by one shared bucket", async () => {
    const cfg: AdminDefinition = {
      adapter: { kind: "drizzle", db: {} } as never,
      auth: {
        session: async (req) => ({ id: req.headers.get("x-user") ?? "nobody" }),
        role: () => "admin",
      },
      resources: [],
      rateLimit: { driver: "memory", limit: 1, windowMs: 60_000, per: "ip" },
    };
    const as = (user: string) =>
      buildRequestContext({
        req: new Request("http://localhost/", { headers: { "x-user": user } }),
        config: cfg,
      });
    await as("u1");
    await expect(as("u2")).resolves.toBeDefined();
    await expect(as("u1")).rejects.toBeInstanceOf(FlowpanelRateLimitError);
  });

  it("does not put callers with neither an IP nor a user id in one bucket", async () => {
    const cfg = mkConfig({ driver: "memory", limit: 1, windowMs: 60_000 }, null);
    const check = () => buildRequestContext({ req: new Request("http://localhost/"), config: cfg });
    await check();
    await expect(check()).resolves.toBeDefined();
  });

  it("keys by the session's top-level id (Clerk/Lucia session shape) when per='user'", async () => {
    // Regression test: `AdminDefinition.auth.session()` for `withClerk` / `withLucia`
    // returns `{ id, ... }` (no `user` wrapper) — before the `actorIdFromSession`
    // fallback fix, this silently degraded to the IP bucket for every visitor.
    const cfg: AdminDefinition = {
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
    const cfg: AdminDefinition = {
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

describe("buildRequestContext — what a hit is", () => {
  const limited = () =>
    mkConfig({ driver: "memory", limit: 1, windowMs: 60_000, per: "user" }, "prefetcher");

  it("does not count a wall's own read of the caller", async () => {
    const cfg = limited();
    const req = () => new Request("http://localhost/");
    await buildRequestContext({ req: req(), config: cfg });
    await expect(buildRequestContext({ req: req(), config: cfg })).rejects.toBeInstanceOf(
      FlowpanelRateLimitError,
    );
    await expect(
      buildRequestContext({ req: req(), config: cfg, rateLimit: false }),
    ).resolves.toMatchObject({ session: { user: { id: "prefetcher" } } });
  });

  it("counts one page view once however often the page reads its caller", async () => {
    const cfg = limited();
    const req = new Request("http://localhost/");
    const first = await buildRequestContext({ req, config: cfg });
    await expect(buildRequestContext({ req, config: cfg })).resolves.toBe(first);
  });
});
