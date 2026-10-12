import { afterEach, describe, expect, it, vi } from "vitest";
import { defineAdmin } from "../define-admin";
import type { AdminDefinition } from "../types/config";

const env = process.env.NODE_ENV;
afterEach(() => {
  process.env.NODE_ENV = env;
});

function admin(overrides: Partial<AdminDefinition>) {
  return () =>
    defineAdmin({
      adapter: { kind: "drizzle", db: {} } as never,
      auth: { session: async () => null, role: () => "guest", access: "admin" },
      ...overrides,
    });
}

const perIp = { driver: "memory", limit: 10, windowMs: 1000, per: "ip" } as const;

describe("a rate limit that cannot tell callers apart", () => {
  it("refuses per: ip without trustedProxies in production and says what to set", () => {
    process.env.NODE_ENV = "production";
    expect(admin({ rateLimit: perIp })).toThrow(
      /\[flowpanel\] rateLimit\.per: it is "ip".*Set security\.trustedProxies .*1 on Vercel.*per: "user".*rateLimit\.enabled: false/,
    );
    expect(admin({ rateLimit: perIp, security: { trustedProxies: 1 } })).not.toThrow();
    expect(admin({ rateLimit: { ...perIp, enabled: false } })).not.toThrow();
  });

  it("warns, in production too, that signed-out visitors go unlimited without trustedProxies", () => {
    process.env.NODE_ENV = "production";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const config = admin({
      readOnly: true,
      auth: { session: async () => null, role: () => "guest", allowUnauthenticated: true },
      rateLimit: { driver: "memory", limit: 10, windowMs: 1000 },
    })();
    expect(config.warnings).toContainEqual(
      expect.stringMatching(
        /^rateLimit: signed-out visitors have no user id.*rateLimit\.enabled: false/,
      ),
    );
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/^\[flowpanel\] rateLimit: /));
    warn.mockRestore();
  });

  it("only warns in development", () => {
    process.env.NODE_ENV = "development";
    const config = admin({ rateLimit: perIp })();
    expect(config.warnings).toContainEqual(expect.stringMatching(/^rateLimit\.per: it is "ip"/));
  });
});
