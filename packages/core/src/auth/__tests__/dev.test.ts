import { afterEach, describe, expect, it, vi } from "vitest";
import { devAuth } from "../dev";

describe("devAuth", () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
  });

  it("returns a static session", async () => {
    await expect(devAuth().session(new Request("http://localhost/admin"))).resolves.toEqual({
      id: "dev",
    });
  });

  it("SECURITY: never returns a session in production", async () => {
    process.env.NODE_ENV = "production";
    await expect(devAuth().session(new Request("http://localhost/admin"))).rejects.toThrow(
      /devAuth\(\) signs every request in as an admin/,
    );
  });

  it("SECURITY: a production config with devAuth fails at startup even with an access rule", async () => {
    process.env.NODE_ENV = "production";
    const { assertProductionAuth } = await import("../../compiler/validate/config");
    expect(() =>
      assertProductionAuth({
        adapter: {} as never,
        auth: { ...devAuth(), access: ({ session }) => session !== null },
      }),
    ).toThrow(/Replace auth: devAuth\(\) with your auth provider/);
  });

  it("defaults the role to admin", () => {
    expect(devAuth().role(null)).toBe("admin");
  });

  it("uses the role it was given", () => {
    expect(devAuth("support").role(null)).toBe("support");
  });

  it("declares no access control of its own", () => {
    const config = devAuth();
    expect(config.access).toBeUndefined();
    expect(config.allowUnauthenticated).toBeUndefined();
  });

  it("does not silence the open-admin development warning", async () => {
    process.env.NODE_ENV = "development";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { warnIfNoAccessControl } = await import("../../compiler/validate/warn-open-admin");
    warnIfNoAccessControl({ adapter: {} as never, auth: devAuth() }, []);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("no access control"));
  });
});
