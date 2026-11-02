import { describe, expect, it, vi } from "vitest";
import { type LuciaLike, withLucia } from "../lucia";

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

  it("forwards access and url overrides", () => {
    const cfg = withLucia({
      lucia: fakeLucia(),
      access: ["admin", "support"],
      signInUrl: "/login",
      forbiddenUrl: "/no-access",
    });
    expect(cfg.access).toEqual(["admin", "support"]);
    expect(cfg.signInUrl).toBe("/login");
    expect(cfg.forbiddenUrl).toBe("/no-access");
  });

  it("session() says what is missing when next/headers cannot load, without a version claim", async () => {
    const cfg = withLucia({ lucia: fakeLucia() });
    const failure = cfg.session(new Request("http://localhost/admin"));
    await expect(failure).rejects.toThrow(
      /could not load next\/headers.*Next\.js app's server code/,
    );
    await expect(cfg.session(new Request("http://localhost/admin"))).rejects.not.toThrow(/16\.3/);
  });

  it("custom role override replaces default", () => {
    const cfg = withLucia({
      lucia: fakeLucia(),
      role: () => "owner",
    });
    expect(cfg.role({ role: "anything" })).toBe("owner");
  });

  it("default userId extractor reads the top-level Lucia user id", () => {
    const cfg = withLucia({ lucia: fakeLucia() });
    expect(cfg.userId?.({ id: "u1" })).toBe("u1");
    expect(cfg.userId?.({ id: 42 })).toBe("42"); // string-coerced (custom adapters may use numeric ids)
    expect(cfg.userId?.(null)).toBeNull();
  });

  it("custom userId override replaces default", () => {
    const cfg = withLucia({ lucia: fakeLucia(), userId: () => "fixed" });
    expect(cfg.userId?.({ id: "u1" })).toBe("fixed");
  });
});
