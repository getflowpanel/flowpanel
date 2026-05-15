import { describe, expect, it, vi } from "vitest";
import { withClerk } from "../clerk.js";

describe("withClerk", () => {
  it("returns AuthConfig with default role extractor (publicMetadata.role)", () => {
    const cfg = withClerk();
    expect(cfg.session).toBeTypeOf("function");
    expect(cfg.role).toBeTypeOf("function");
    // default role: extracts from publicMetadata
    expect(cfg.role({ publicMetadata: { role: "admin" } })).toBe("admin");
    expect(cfg.role({ publicMetadata: { role: 42 } })).toBe("guest"); // non-string falls back
    expect(cfg.role(null)).toBe("guest");
    expect(cfg.role({})).toBe("guest");
  });

  it("forwards requireRole, signInUrl, forbiddenUrl", () => {
    const cfg = withClerk({
      requireRole: ["admin", "support"],
      signInUrl: "/sign-in",
      forbiddenUrl: "/403",
    });
    expect(cfg.requireRole).toEqual(["admin", "support"]);
    expect(cfg.signInUrl).toBe("/sign-in");
    expect(cfg.forbiddenUrl).toBe("/403");
  });

  it("custom role override replaces default", () => {
    const cfg = withClerk({
      role: () => "owner",
    });
    expect(cfg.role(null)).toBe("owner");
  });

  it("session() throws a clear error when @clerk/nextjs is not installed", async () => {
    const cfg = withClerk();
    // The dynamic import will resolve to null (module not found in this env);
    // we can't easily mock import() so we just assert it errors descriptively.
    await expect(cfg.session()).rejects.toThrow(/@clerk\/nextjs is not installed/);
  });
});
