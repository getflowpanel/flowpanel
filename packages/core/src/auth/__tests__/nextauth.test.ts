import { describe, expect, it, vi } from "vitest";
import { withNextAuth } from "../nextauth";

describe("withNextAuth", () => {
  it("delegates session() to the user-supplied auth() function", async () => {
    const auth = vi.fn().mockResolvedValue({ user: { id: "u1", role: "admin" } });
    const cfg = withNextAuth({ auth });
    const s = await cfg.session(new Request("http://localhost/admin"));
    expect(s).toEqual({ user: { id: "u1", role: "admin" } });
    expect(auth).toHaveBeenCalledOnce();
  });

  it("session returns null when auth() resolves to undefined", async () => {
    const cfg = withNextAuth({ auth: async () => undefined });
    expect(await cfg.session(new Request("http://localhost/admin"))).toBeNull();
  });

  it("default role extractor reads session.user.role", () => {
    const cfg = withNextAuth({ auth: async () => null });
    expect(cfg.role({ user: { role: "admin" } })).toBe("admin");
    expect(cfg.role({ user: {} })).toBe("guest");
    expect(cfg.role(null)).toBe("guest");
  });

  it("forwards requireRole and url overrides", () => {
    const cfg = withNextAuth({
      auth: async () => null,
      requireRole: "admin",
      signInUrl: "/login",
      forbiddenUrl: "/forbidden",
    });
    expect(cfg.requireRole).toBe("admin");
    expect(cfg.signInUrl).toBe("/login");
    expect(cfg.forbiddenUrl).toBe("/forbidden");
  });

  it("default userId extractor reads session.user.id", () => {
    const cfg = withNextAuth({ auth: async () => null });
    expect(cfg.userId?.({ user: { id: "u1" } })).toBe("u1");
    expect(cfg.userId?.({ user: {} })).toBeNull();
    expect(cfg.userId?.(null)).toBeNull();
  });

  it("custom userId override replaces default", () => {
    const cfg = withNextAuth({ auth: async () => null, userId: () => "fixed" });
    expect(cfg.userId?.({ user: { id: "u1" } })).toBe("fixed");
  });
});
