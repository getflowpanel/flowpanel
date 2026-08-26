import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish", () => ({
  publish: vi.fn(),
  publishResource: vi.fn(),
  bindPublisher: vi.fn(),
}));

import type { Adapter, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { importRoute } from "../actions/resource-import";
import { publishResource } from "../runtime/publish";

const createSchema = z.object({ email: z.string().email() });

function makeConfig(
  opts: { rateLimit?: { driver: "memory"; limit: number; windowMs: number } } = {},
) {
  const created: unknown[] = [];
  const adapter: Adapter = {
    kind: "drizzle",
    db: {},
    introspect: () => ({ name: "users", columns: [], primaryKey: "id" }),
    inferSchema: () => ({ create: createSchema, update: createSchema.partial() }) as never,
    list: async () => ({ rows: [], total: 0, page: 1, pageSize: 10 }),
    get: async () => null,
    create: async (_ref, mctx) => {
      created.push((mctx as { input: unknown }).input);
      return { id: `u${created.length}` } as Record<string, unknown>;
    },
    update: async () => null,
    delete: async () => undefined,
  };
  const resource: ResourceConfig = {
    __kind: "resource",
    ref: { __name: "users" },
    options: {
      columns: [{ field: "id" }, { field: "email" }],
      import: { formats: ["csv", "json"] },
    },
  } as never;
  const config: ResolvedAdminConfig = {
    adapter,
    auth: { session: async () => null, role: () => "admin" },
    resources: [resource],
    resourcesByName: new Map([["users", resource]]),
    dashboardsByPath: new Map(),
    ...(opts.rateLimit ? { rateLimit: opts.rateLimit } : {}),
    __resolved: true,
  } as never;
  return { config, created };
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/flowpanel/users/import", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });
}

/** A streamed body with no declared length, like a chunked-transfer-encoding upload. */
function postChunked(totalBytes: number, chunkSize = 64 * 1024): Request {
  let sent = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= totalBytes) {
        controller.close();
        return;
      }
      const size = Math.min(chunkSize, totalBytes - sent);
      controller.enqueue(new Uint8Array(size).fill(97));
      sent += size;
    },
  });
  return new Request("http://localhost/api/flowpanel/users/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

const params = { params: Promise.resolve({ resource: "users" }) };

describe("importRoute", () => {
  beforeEach(() => {
    vi.mocked(publishResource).mockReset();
    vi.mocked(revalidatePath).mockReset();
  });

  it("rejects an oversized request by Content-Length before reading the body", async () => {
    const { config } = makeConfig();
    const req = post(
      { format: "json", content: "[]" },
      { "content-length": String(50 * 1024 * 1024) },
    );
    const res = await importRoute(config)(req, params);
    expect(res.status).toBe(413);
  });

  it("rejects an oversized chunked body (no Content-Length) while streaming it", async () => {
    const { config } = makeConfig();
    expect(postChunked(1).headers.get("content-length")).toBeNull();
    const req = postChunked(11 * 1024 * 1024); // over MAX_IMPORT_REQUEST_BYTES (10 MB)
    const res = await importRoute(config)(req, params);
    expect(res.status).toBe(413);
  });

  it("keeps field-level detail in per-row validation failures", async () => {
    const { config, created } = makeConfig();
    const content = JSON.stringify([{ email: "ok@b.com" }, { email: "not-an-email" }]);
    const res = await importRoute(config)(post({ format: "json", content }), params);
    const body = (await res.json()) as {
      imported: number;
      failed: { row: number; error: string }[];
    };
    expect(body.imported).toBe(1);
    expect(created).toEqual([{ email: "ok@b.com" }]);
    expect(body.failed).toHaveLength(1);
    expect(body.failed[0]?.row).toBe(2);
    // Not the generic "Validation failed" — the failing field and its message.
    expect(body.failed[0]?.error).toMatch(/^email: /);
  });

  it("consumes one rate-limit token per import, not one per row", async () => {
    const { config, created } = makeConfig({
      rateLimit: { driver: "memory", limit: 1, windowMs: 60_000 },
    });
    const rows = [{ email: "a@b.com" }, { email: "b@b.com" }, { email: "c@b.com" }];
    const res = await importRoute(config)(
      post({ format: "json", content: JSON.stringify(rows) }),
      params,
    );
    const body = (await res.json()) as { imported: number; failed: unknown[] };
    expect(body.imported).toBe(3);
    expect(body.failed).toEqual([]);
    expect(created).toHaveLength(3);
  });

  it("publishes and revalidates exactly once for a multi-row import, not once per row", async () => {
    const { config } = makeConfig();
    const rows = [{ email: "a@b.com" }, { email: "b@b.com" }, { email: "c@b.com" }];
    const res = await importRoute(config)(
      post({ format: "json", content: JSON.stringify(rows) }),
      params,
    );
    const body = (await res.json()) as { imported: number };
    expect(body.imported).toBe(3);
    expect(publishResource).toHaveBeenCalledTimes(1);
    expect(publishResource).toHaveBeenCalledWith("users", { action: "create" });
    expect(revalidatePath).toHaveBeenCalledTimes(1);
  });

  it("does not publish or revalidate when every row fails", async () => {
    const { config } = makeConfig();
    const rows = [{ email: "not-an-email" }];
    const res = await importRoute(config)(
      post({ format: "json", content: JSON.stringify(rows) }),
      params,
    );
    const body = (await res.json()) as { imported: number };
    expect(body.imported).toBe(0);
    expect(publishResource).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("still reports the true counts when the post-import notify throws", async () => {
    const { config } = makeConfig();
    vi.mocked(publishResource).mockRejectedValueOnce(new Error("redis is down"));
    const rows = [{ email: "a@b.com" }, { email: "not-an-email" }, { email: "c@b.com" }];
    const res = await importRoute(config)(
      post({ format: "json", content: JSON.stringify(rows) }),
      params,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; imported: number; failed: unknown[] };
    expect(body.ok).toBe(true);
    expect(body.imported).toBe(2);
    expect(body.failed).toHaveLength(1);
  });

  it("publishes and revalidates exactly once when some rows fail and some succeed", async () => {
    const { config } = makeConfig();
    const rows = [{ email: "a@b.com" }, { email: "not-an-email" }, { email: "c@b.com" }];
    const res = await importRoute(config)(
      post({ format: "json", content: JSON.stringify(rows) }),
      params,
    );
    const body = (await res.json()) as { imported: number; failed: unknown[] };
    expect(body.imported).toBe(2);
    expect(body.failed).toHaveLength(1);
    expect(publishResource).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledTimes(1);
  });
});
