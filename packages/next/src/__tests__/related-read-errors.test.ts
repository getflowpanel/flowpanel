import type { Adapter, RequestContext } from "@flowpanel/core";
import { defineAdmin, FlowpanelAccessError, resource } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { readRelatedPage } from "../runtime/require-authorized";

function admin(list: Adapter["list"], role = "admin") {
  const config = defineAdmin({
    adapter: {
      kind: "drizzle",
      db: {},
      introspect: () => ({ name: "notes", columns: [], primaryKey: "id" }),
      inferSchema: () => ({}) as never,
      list,
      get: async () => null,
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => undefined,
    },
    auth: { session: async () => null, role: () => role },
    resources: [resource({ __name: "notes" }, { columns: ["id"], access: { read: "admin" } })],
  });
  const reqCtx: RequestContext = {
    req: new Request("http://localhost/admin"),
    session: null,
    role,
    scope: null,
    ip: null,
    userAgent: null,
  };
  const notes = config.resourcesByName.get("notes");
  if (!notes) throw new Error("notes not registered");
  return { config, notes, reqCtx };
}

describe("a related read", () => {
  it("reads as nothing when the caller may not read the target", async () => {
    const { config, notes, reqCtx } = admin(
      async () => ({ rows: [], total: 0, page: 1, pageSize: 1 }),
      "viewer",
    );
    expect(await readRelatedPage(config, notes, reqCtx)).toBeNull();
  });

  it("surfaces an access error the adapter raises, such as a scope that adds no clause", async () => {
    const { config, notes, reqCtx } = admin(async () => {
      throw new FlowpanelAccessError("scope added no where clause");
    });
    await expect(readRelatedPage(config, notes, reqCtx)).rejects.toThrow(
      "scope added no where clause",
    );
  });
});
