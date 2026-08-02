import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Adapter, AdminConfig } from "../index.js";
import { defineAdmin, resource } from "../index.js";

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

const open: AdminConfig = {
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

  it("is silent when auth.requireRole is set", () => {
    defineAdmin({ ...open, auth: { ...open.auth, requireRole: (s) => s !== null } });
    expect(warn).not.toHaveBeenCalled();
  });

  it("is silent when any resource sets requireRole", () => {
    defineAdmin({
      ...open,
      resources: [resource({ __name: "users" }, { columns: [], requireRole: "admin" })],
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it("is silent when a global scope is configured", () => {
    defineAdmin({ ...open, scope: () => null });
    expect(warn).not.toHaveBeenCalled();
  });

  it("is silent in production", () => {
    process.env.NODE_ENV = "production";
    defineAdmin(open);
    expect(warn).not.toHaveBeenCalled();
  });

  it("is silent when the deployment opts out explicitly", () => {
    defineAdmin({ ...open, auth: { ...open.auth, allowUnauthenticated: true } });
    expect(warn).not.toHaveBeenCalled();
  });
});
