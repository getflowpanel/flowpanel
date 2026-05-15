import { describe, expect, it, vi } from "vitest";
import { type LuciaLike, withLucia } from "../lucia.js";

function fakeLucia(overrides: Partial<LuciaLike> = {}): LuciaLike {
  return {
    sessionCookieName: "auth_session",
    validateSession: vi.fn().mockResolvedValue({ user: null, session: null }),
    ...overrides,
  };
}

describe("withLucia", () => {
  it("default role extractor reads session.role", () => {
    const cfg = withLucia({ lucia: fakeLucia() });
    expect(cfg.role({ role: "admin" })).toBe("admin");
    expect(cfg.role({ role: 42 })).toBe("guest"); // non-string → guest
    expect(cfg.role(null)).toBe("guest");
  });

  it("forwards requireRole and url overrides", () => {
    const cfg = withLucia({
      lucia: fakeLucia(),
      requireRole: ["admin", "support"],
      signInUrl: "/login",
      forbiddenUrl: "/no-access",
    });
    expect(cfg.requireRole).toEqual(["admin", "support"]);
    expect(cfg.signInUrl).toBe("/login");
    expect(cfg.forbiddenUrl).toBe("/no-access");
  });

  it("session() returns null when next/headers is unavailable in test env", async () => {
    // next/headers can't be loaded outside Next runtime.
    const cfg = withLucia({ lucia: fakeLucia() });
    // either the import returns null and we throw, OR we return null silently
    await expect(cfg.session()).rejects.toThrow(/next\/headers is unavailable/);
  });

  it("custom role override replaces default", () => {
    const cfg = withLucia({
      lucia: fakeLucia(),
      role: () => "owner",
    });
    expect(cfg.role({ role: "anything" })).toBe("owner");
  });
});
