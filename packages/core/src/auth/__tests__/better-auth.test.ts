import { describe, expect, it, vi } from "vitest";
import { withBetterAuth } from "../better-auth";

function betterAuth(session: unknown) {
  const getSession = vi.fn().mockResolvedValue(session);
  return { auth: { api: { getSession } }, getSession };
}

describe("withBetterAuth", () => {
  it("reads the session from the request's own headers", async () => {
    const { auth, getSession } = betterAuth({ user: { id: "u1", role: "admin" } });
    const cfg = withBetterAuth({ auth });
    const req = new Request("http://localhost/admin", { headers: { cookie: "s=1" } });
    expect(await cfg.session(req)).toEqual({ user: { id: "u1", role: "admin" } });
    expect(getSession).toHaveBeenCalledWith({ headers: req.headers });
  });

  it("session returns null when better-auth answers undefined", async () => {
    const { auth } = betterAuth(undefined);
    const cfg = withBetterAuth({ auth });
    expect(await cfg.session(new Request("http://localhost/admin"))).toBeNull();
  });

  it("returns null rather than a session for anything that is not { user: {} }", async () => {
    for (const answer of ["session!", 7, true, {}, { user: null }, { user: "u1" }, []]) {
      const cfg = withBetterAuth({ auth: betterAuth(answer).auth });
      expect(await cfg.session(new Request("http://localhost/admin"))).toBeNull();
    }
  });

  it("returns null without throwing when the provider itself fails", async () => {
    const cfg = withBetterAuth({
      auth: { api: { getSession: () => Promise.reject(new Error("db down")) } },
    });
    expect(await cfg.session(new Request("http://localhost/admin"))).toBeNull();
  });

  it("default role extractor reads session.user.role", () => {
    const cfg = withBetterAuth({ auth: betterAuth(null).auth });
    expect(cfg.role({ user: { role: "admin" } })).toBe("admin");
    expect(cfg.role({ user: {} })).toBe("guest");
    expect(cfg.role(null)).toBe("guest");
  });

  it("accepts an async role lookup", async () => {
    const cfg = withBetterAuth({
      auth: betterAuth(null).auth,
      role: async (s) => (s?.user as { id?: string } | undefined)?.id ?? "guest",
    });
    expect(await cfg.role({ user: { id: "owner" } })).toBe("owner");
  });

  it("default userId extractor reads session.user.id", () => {
    const cfg = withBetterAuth({ auth: betterAuth(null).auth });
    expect(cfg.userId?.({ user: { id: 7 } })).toBe("7");
    expect(cfg.userId?.({ user: {} })).toBeNull();
    expect(cfg.userId?.(null)).toBeNull();
  });

  it("forwards requireRole and url overrides", () => {
    const cfg = withBetterAuth({
      auth: betterAuth(null).auth,
      requireRole: "admin",
      signInUrl: "/sign-in",
      forbiddenUrl: "/forbidden",
      userId: () => "fixed",
    });
    expect(cfg.requireRole).toBe("admin");
    expect(cfg.signInUrl).toBe("/sign-in");
    expect(cfg.forbiddenUrl).toBe("/forbidden");
    expect(cfg.userId?.({ user: { id: "u1" } })).toBe("fixed");
  });
});
