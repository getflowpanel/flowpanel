import { defineAdmin, resource } from "@flowpanel/core";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ getAll: () => [] }),
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  const ids = new WeakMap<object, number>();
  let next = 0;
  const keyOf = (value: unknown) => {
    if (typeof value !== "object" || value === null) return JSON.stringify(value);
    if (!ids.has(value)) ids.set(value, ++next);
    return `#${ids.get(value)}`;
  };
  const cache = <A extends unknown[], T>(fn: (...args: A) => T) => {
    const memo = new Map<string, T>();
    return (...args: A): T => {
      const key = args.map(keyOf).join("|");
      if (!memo.has(key)) memo.set(key, fn(...args));
      return memo.get(key) as T;
    };
  };
  return { ...actual, cache };
});

import { ResourceDetailPage } from "../pages/resource-detail";
import { flowpanelMetadata } from "../runtime/page-metadata";
import { pageRequest } from "../runtime/page-url";
import { buildRequestContext } from "../runtime/request-setup";
import { adapter } from "./detail-fixture";

describe("a record page and its <title> in one render", () => {
  it("read the record once and run detail.title once", async () => {
    const get = vi.fn(adapter.get);
    const title = vi.fn((row: Record<string, unknown>) => String(row.email));
    const config = defineAdmin({
      adapter: { ...adapter, get },
      auth: { session: async () => ({ id: "u1" }), role: () => "admin" },
      resources: [
        resource(
          { __name: "users" },
          {
            columns: ["id", "email"],
            detail: { title },
          },
        ),
      ],
    });
    const users = config.resourcesByName.get("users");
    if (!users) throw new Error("users not registered");

    const metadata = await flowpanelMetadata(config)({
      params: Promise.resolve({ slug: ["users", "u1"] }),
      searchParams: Promise.resolve({}),
    });
    const { req } = await pageRequest(config, ["users", "u1"], new URLSearchParams());
    const reqCtx = await buildRequestContext({ req, config });
    await ResourceDetailPage({ config, resource: users, name: "users", id: "u1", req, reqCtx });

    expect(metadata.title).toBe("ada@example.com");
    expect(title).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledTimes(1);
  });
});
