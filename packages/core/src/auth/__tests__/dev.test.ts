import { afterEach, describe, expect, it, vi } from "vitest";
import { devAuth } from "../dev";

describe("devAuth", () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
  });

  it("returns a static session", async () => {
    await expect(devAuth().session()).resolves.toEqual({ id: "dev" });
  });

  it("defaults the role to admin", () => {
    expect(devAuth().role(null)).toBe("admin");
  });

  it("uses the role it was given", () => {
    expect(devAuth("support").role(null)).toBe("support");
  });

  it("declares no access control of its own", () => {
    const config = devAuth();
    expect(config.requireRole).toBeUndefined();
    expect(config.allowUnauthenticated).toBeUndefined();
  });

  it("does not silence the open-admin development warning", async () => {
    process.env.NODE_ENV = "development";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { warnIfNoAccessControl } = await import("../../warn-open-admin");
    warnIfNoAccessControl({ adapter: {} as never, auth: devAuth() }, []);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("no access control"));
  });
});
