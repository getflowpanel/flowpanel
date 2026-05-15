import { describe, expect, it, vi } from "vitest";
import { withNextAuth } from "../nextauth.js";

describe("withNextAuth", () => {
  it("delegates session() to the user-supplied auth() function", async () => {
    const auth = vi.fn().mockResolvedValue({ user: { id: "u1", role: "admin" } });
    const cfg = withNextAuth({ auth });
    const s = await cfg.session();
    expect(s).toEqual({ user: { id: "u1", role: "admin" } });
    expect(auth).toHaveBeenCalledOnce();
  });

  it("session returns null when auth() resolves to undefined", async () => {
    const cfg = withNextAuth({ auth: async () => undefined });
    expect(await cfg.session()).toBeNull();
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
});
