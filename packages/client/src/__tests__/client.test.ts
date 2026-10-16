import { describe, expect, it, vi } from "vitest";
import { clientMetadata, createFlowpanelClient } from "../client";

const metadata = {
  id: "acme",
  paths: { admin: "/admin", api: "/api/flowpanel" },
  protocol: { version: 1 as const, methods: ["GET", "POST", "PATCH", "DELETE"] },
};

describe("createFlowpanelClient", () => {
  it("builds credentialed resource requests and preserves the result envelope", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        ok: true,
        data: { rows: [{ id: "c1" }], total: 1, page: 2, pageSize: 20 },
        meta: { requestId: "req-1" },
      }),
    );
    const client = createFlowpanelClient(metadata, { fetch: fetcher });

    const result = await client.resource("customers").list({
      page: 2,
      filters: { status: "active" },
    });

    expect(result).toMatchObject({ ok: true, meta: { requestId: "req-1" } });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/flowpanel/customers?page=2&filter.status=active",
      expect.objectContaining({ method: "GET", credentials: "same-origin" }),
    );
  });

  it("reaches the API from a script through a base URL and default headers", async () => {
    const fetcher = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({ ok: true, data: { id: "c1" }, meta: { requestId: "req-2" } }),
    );
    const admin = { paths: { admin: "/admin", api: "/api/flowpanel" } };
    const client = createFlowpanelClient(clientMetadata(admin), {
      fetch: fetcher,
      baseUrl: "http://localhost:3000/",
      headers: { cookie: "session=abc", "x-trace": "default" },
    });

    await client.resource("customers").get("c1", { headers: { "x-trace": "call" } });

    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe("http://localhost:3000/api/flowpanel/customers/c1");
    const headers = new Headers(init?.headers);
    expect(headers.get("cookie")).toBe("session=abc");
    expect(headers.get("x-trace")).toBe("call");
  });

  it("builds protocol metadata from the admin's own paths", () => {
    expect(clientMetadata({ id: "acme", paths: { admin: "/ops", api: "/api/ops" } })).toEqual({
      id: "acme",
      paths: { admin: "/ops", api: "/api/ops" },
      protocol: { version: 1, methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] },
    });
  });

  it("does not leak malformed or network response details", async () => {
    const malformed = createFlowpanelClient(metadata, {
      fetch: async () => new Response("proxy exploded", { status: 502 }),
    });
    await expect(malformed.resource("customers").get("c1")).resolves.toEqual({
      ok: false,
      error: { code: "internal", message: "Unexpected response from Flowpanel." },
    });

    const offline = createFlowpanelClient(metadata, {
      fetch: async () => {
        throw new Error("secret upstream hostname");
      },
    });
    await expect(offline.resource("customers").get("c1")).resolves.toEqual({
      ok: false,
      error: { code: "internal", message: "Unable to reach Flowpanel." },
    });
  });

  it("rejects ambiguous path segments before fetch", () => {
    const client = createFlowpanelClient(metadata, { fetch: vi.fn() });
    expect(() => client.resource("..")).toThrow("Invalid Flowpanel path segment");
  });
});
