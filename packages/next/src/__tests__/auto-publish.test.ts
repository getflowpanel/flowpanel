import type { Adapter, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/cache so revalidatePath is a no-op in tests
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Spy on the publisher module we'll create — use dynamic import after mock
vi.mock("../runtime/publish.js", () => ({
  publish: vi.fn(),
  publishResource: vi.fn(),
}));

import { makeActions } from "../actions/resource-actions.js";
import { publishResource } from "../runtime/publish.js";

function fakeConfig(): { config: ResolvedAdminConfig; resource: ResourceConfig } {
  const adapter: Adapter = {
    kind: "drizzle",
    db: {},
    introspect: () => ({ name: "x", columns: [], primaryKey: "id" }),
    inferSchema: () => {
      const z = require("zod") as typeof import("zod");
      return {
        create: z.object({}).passthrough(),
        update: z.object({}).passthrough(),
        select: z.object({}).passthrough(),
      };
    },
    list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
    get: async () => ({ id: "seed-1" }),
    create: async () => ({ id: "seed-1" }),
    update: async () => ({ id: "seed-1" }),
    delete: async () => undefined,
  };
  const resource: ResourceConfig = {
    __kind: "resource",
    ref: { __name: "widgets" },
    options: { columns: [] },
  } as never;
  const config: ResolvedAdminConfig = {
    adapter,
    auth: { session: async () => null, role: () => "guest" },
    resources: [resource],
    resourcesByName: new Map([["widgets", resource]]),
    dashboardsByPath: new Map(),
    __resolved: true,
  } as never;
  return { config, resource };
}

describe("auto-publish on mutations", () => {
  beforeEach(() => {
    vi.mocked(publishResource).mockReset();
  });

  it("publishes resource.<name> with action=create + id after create", async () => {
    const { config, resource } = fakeConfig();
    const actions = makeActions(config, resource);
    await actions.create({ name: "foo" });
    expect(publishResource).toHaveBeenCalledWith("widgets", {
      action: "create",
      id: "seed-1",
    });
  });

  it("publishes action=update + id after update", async () => {
    const { config, resource } = fakeConfig();
    const actions = makeActions(config, resource);
    await actions.update("seed-1", { name: "bar" });
    expect(publishResource).toHaveBeenCalledWith("widgets", {
      action: "update",
      id: "seed-1",
    });
  });

  it("publishes action=delete + id after delete", async () => {
    const { config, resource } = fakeConfig();
    const actions = makeActions(config, resource);
    await actions.delete("seed-1");
    expect(publishResource).toHaveBeenCalledWith("widgets", {
      action: "delete",
      id: "seed-1",
    });
  });
});
