import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish", () => ({
  publish: vi.fn(async () => {}),
  publishResource: vi.fn(async () => {}),
  bindPublisher: vi.fn(),
}));

import { type AuditEvent, defineAdmin, resource } from "@flowpanel/core";
import { rowActionRoute } from "../actions/row-action";
import { publishResource } from "../runtime/publish";

describe("a row action whose after-read fails", () => {
  it("still answers ok, audits without a diff and publishes, since the write committed", async () => {
    const audited: AuditEvent[] = [];
    const onError = vi.fn(async () => {});
    let reads = 0;
    const config = defineAdmin({
      adapter: {
        kind: "drizzle",
        db: {},
        introspect: () => ({ name: "jobs", columns: [], primaryKey: "id" }),
        inferSchema: () => ({}) as never,
        list: async () => ({ rows: [], total: 0, page: 1, pageSize: 1 }),
        get: async () => {
          reads += 1;
          if (reads > 1) throw new Error("connection reset");
          return { id: "j1", state: "queued" };
        },
        create: async () => ({}),
        update: async () => ({}),
        delete: async () => undefined,
      },
      auth: { session: async () => ({ id: "u1" }), role: () => "admin" },
      hooks: { onError },
      audit: {
        sink: async (event: AuditEvent) => {
          audited.push(event);
        },
      },
      resources: [
        resource(
          { __name: "jobs" },
          {
            columns: ["state"],
            actions: [{ key: "run", label: "Run", run: async () => ({ ok: true, refresh: true }) }],
          },
        ),
      ],
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await rowActionRoute(config)(
      new Request("http://localhost/x", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
      { params: Promise.resolve({ resource: "jobs", id: "j1", action: "run" }) },
    );
    error.mockRestore();
    expect(res.status).toBe(200);
    expect(audited).toMatchObject([{ action: "jobs.action.run", targetId: "j1" }]);
    expect(audited[0]?.diff).toBeUndefined();
    expect(publishResource).toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "connection reset" }),
      expect.objectContaining({ route: "audit-diff", actorId: "u1" }),
    );
  });
});
