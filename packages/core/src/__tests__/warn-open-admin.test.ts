import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Adapter, AdminDefinition } from "../index";
import { defineAdmin, resource } from "../index";

const fakeAdapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: () => ({ name: "users", columns: [], primaryKey: "id" }),
  inferSchema: () => ({ create: {} as any, update: {} as any, select: {} as any }),
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => {},
};

const open: AdminDefinition = {
  adapter: fakeAdapter,
  auth: { session: async () => null, role: () => "guest" },
  resources: [resource({ __name: "users" }, { columns: [] })],
};

let warn: ReturnType<typeof vi.spyOn>;
let originalEnv: string | undefined;

beforeEach(() => {
  originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
  process.env.NODE_ENV = originalEnv;
});

describe("no-access-control warning", () => {
  it("fires when nothing in the config can reject a request", () => {
    defineAdmin(open);
    expect(warn).toHaveBeenCalledTimes(1);
    const msg = String(warn.mock.calls[0]?.[0]);
    expect(msg).toContain("has no access control");
    expect(msg).toContain("auth: { allowUnauthenticated: true }");
  });

  it("is silent when auth.access is set", () => {
    defineAdmin({ ...open, auth: { ...open.auth, access: ({ session }) => session !== null } });
    expect(warn).not.toHaveBeenCalled();
  });

  it("is silent when any resource sets access", () => {
    defineAdmin({
      ...open,
      resources: [resource({ __name: "users" }, { columns: [], access: { read: "admin" } })],
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it("is silent when a global scope is configured", () => {
    defineAdmin({ ...open, scope: () => null });
    expect(warn).not.toHaveBeenCalled();
  });

  it("fails closed in production when anonymous access was not acknowledged", () => {
    process.env.NODE_ENV = "production";
    expect(() => defineAdmin({ ...open })).toThrow(/production admin requires auth\.access/i);
    expect(warn).not.toHaveBeenCalled();
  });

  it("allows acknowledged anonymous production access only in read-only mode", () => {
    process.env.NODE_ENV = "production";
    expect(() =>
      defineAdmin({
        ...open,
        readOnly: true,
        auth: { ...open.auth, allowUnauthenticated: true },
      }),
    ).not.toThrow();
    expect(() =>
      defineAdmin({ ...open, auth: { ...open.auth, allowUnauthenticated: true } }),
    ).toThrow(/must also set readOnly: true/i);
  });

  it("is silent when the deployment opts out explicitly", () => {
    defineAdmin({ ...open, auth: { ...open.auth, allowUnauthenticated: true } });
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("an auth.access that lets a signed-out visitor in", () => {
  const renamed = (s: unknown) => s !== null;

  it("warns in development about the renamed 0.3 null check", () => {
    defineAdmin({ ...open, auth: { ...open.auth, access: renamed } });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("lets a signed-out visitor in");
  });

  it("warns for access: true and for a role list holding the signed-out role", () => {
    defineAdmin({ ...open, auth: { ...open.auth, access: true } });
    defineAdmin({ ...open, auth: { ...open.auth, access: ["guest", "admin"] } });
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("refuses to start in production, like an admin without access", () => {
    process.env.NODE_ENV = "production";
    expect(() => defineAdmin({ ...open, auth: { ...open.auth, access: renamed } })).toThrow(
      /auth\.access lets a signed-out visitor in.*\(\{ session \}\) => session !== null/,
    );
    expect(() =>
      defineAdmin({
        ...open,
        readOnly: true,
        auth: { ...open.auth, access: renamed, allowUnauthenticated: true },
      }),
    ).not.toThrow();
  });

  it("stays quiet for rules that turn a signed-out visitor away or answer asynchronously", () => {
    process.env.NODE_ENV = "production";
    for (const access of [
      ({ session }: { session: unknown }) => session !== null,
      "admin",
      async () => true,
    ]) {
      expect(() => defineAdmin({ ...open, auth: { ...open.auth, access } })).not.toThrow();
    }
  });
});
