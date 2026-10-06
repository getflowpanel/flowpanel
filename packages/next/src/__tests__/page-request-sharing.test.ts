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
  const renderCache = new Map<string, unknown>();
  const cache =
    <T>(fn: (key: string) => T) =>
    (key: string): T => {
      if (!renderCache.has(key)) renderCache.set(key, fn(key));
      return renderCache.get(key) as T;
    };
  return { ...actual, cache };
});

import { flowpanelMetadata } from "../runtime/page-metadata";
import { pageRequest } from "../runtime/page-url";
import { buildRequestContext } from "../runtime/request-setup";
import { adapter } from "./detail-fixture";

describe("a page and its metadata in one render", () => {
  it("authenticate and rate-limit the caller once", async () => {
    const session = vi.fn(async () => ({ id: "u1" }) as never);
    const config = defineAdmin({
      adapter,
      auth: { session, role: () => "admin" },
      rateLimit: { driver: "memory", limit: 1, windowMs: 60_000 },
      resources: [resource({ __name: "users" }, { label: "Users", columns: ["id"] })],
    });

    const metadata = await flowpanelMetadata(config)({
      params: Promise.resolve({ slug: ["users"] }),
      searchParams: Promise.resolve({ page: "2" }),
    });
    const { req } = await pageRequest(config, ["users"], new URLSearchParams("page=2"));
    const reqCtx = await buildRequestContext({ req, config });

    expect(metadata.title).toBe("Users");
    expect(reqCtx.session).toEqual({ id: "u1" });
    expect(session).toHaveBeenCalledTimes(1);
  });
});
