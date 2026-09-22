import type { Adapter, LabelsConfig } from "@flowpanel/core";
import { defineAdmin, FlowpanelAccessError, RU_LABELS, resource } from "@flowpanel/core";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResourceDetailPage } from "../pages/resource-detail";
import { ResourceListPage } from "../pages/resource-list";
import { QueryErrorCard, type QuerySite, readOrCard } from "../runtime/query-error";

const COLUMNS = [
  { name: "id", type: "string" as const, nullable: false, unique: true, primaryKey: true },
  { name: "email", type: "string" as const, nullable: false, unique: true, primaryKey: false },
];

function adapterThatFails(on: "list" | "get", err: unknown): Adapter {
  return {
    kind: "drizzle",
    db: {},
    introspect: () => ({ name: "users", columns: COLUMNS, primaryKey: "id" }),
    inferSchema: () => ({}) as never,
    list: async () => {
      if (on === "list") throw err;
      return { rows: [], total: 0, page: 1, pageSize: 20 };
    },
    get: async () => {
      if (on === "get") throw err;
      return { id: "u1", email: "a@b.c" };
    },
    create: async () => ({}),
    update: async () => ({}),
    delete: async () => undefined,
  };
}

function admin(adapter: Adapter, labels?: LabelsConfig) {
  return defineAdmin({
    adapter,
    auth: { session: async () => null, role: () => "admin", requireRole: "admin" },
    ...(labels ? { labels } : {}),
    resources: [resource({ __name: "users" }, { columns: ["id", "email"] })],
  });
}

/** Every string the tree would show, in order, without a DOM renderer. */
function textOf(tree: ReactNode): string {
  if (tree === null || tree === undefined || typeof tree === "boolean") return "";
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  if (Array.isArray(tree)) return tree.map(textOf).join(" ");
  if (!isValidElement(tree)) return "";
  const el = tree as ReactElement<{ children?: ReactNode }>;
  if (typeof el.type === "function") {
    return textOf((el.type as (props: unknown) => ReactNode)(el.props));
  }
  return textOf(el.props.children);
}

async function listText(adapter: Adapter, labels?: LabelsConfig) {
  const config = admin(adapter, labels);
  const users = config.resourcesByName.get("users");
  if (!users) throw new Error("fixture: resource not registered");
  return textOf(
    await ResourceListPage({
      config,
      resource: users,
      searchParams: new URLSearchParams(),
      req: new Request("http://localhost/admin/users", { headers: { "x-request-id": "req-77" } }),
    }),
  );
}

async function detailText(adapter: Adapter) {
  const config = admin(adapter);
  const users = config.resourcesByName.get("users");
  if (!users) throw new Error("fixture: resource not registered");
  return textOf(
    await ResourceDetailPage({
      config,
      resource: users,
      name: "users",
      id: "u1",
      req: new Request("http://localhost/admin/users/u1", {
        headers: { "x-request-id": "req-88" },
      }),
    }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("a page whose adapter read failed", () => {
  it("names the resource and the operation instead of crashing the route", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const text = await listText(adapterThatFails("list", new Error('column "emial" not found')));
    expect(text).toContain("users: list failed");
    expect(text).toContain("Check the column list and the database schema.");
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("logs the cause under the request id and shows the same id", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const cause = new Error("connection refused");
    expect(await listText(adapterThatFails("list", cause))).toContain("Request req-77");
    expect(error.mock.calls[0]?.[0]).toContain("users: list failed (request req-77)");
    expect(error.mock.calls[0]?.[1]).toBe(cause);
  });

  it("shows the cause in development and withholds it in production", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "development");
    expect(await listText(adapterThatFails("list", new Error("relation missing")))).toContain(
      "relation missing",
    );
    vi.stubEnv("NODE_ENV", "production");
    const production = await listText(adapterThatFails("list", new Error("relation missing")));
    expect(production).not.toContain("relation missing");
    expect(production).toContain("Request req-77");
  });

  it("covers the detail page's own read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const text = await detailText(adapterThatFails("get", new Error("boom")));
    expect(text).toContain("users: get failed");
    expect(text).toContain("Request req-88");
  });

  it("speaks the admin's language", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const text = await listText(adapterThatFails("list", new Error("boom")), RU_LABELS);
    expect(text).toContain("users: операция «list» не выполнена");
  });
});

describe("what the card must not swallow", () => {
  const site: QuerySite = {
    config: admin(adapterThatFails("list", null)),
    resource: "users",
    operation: "list",
  };

  it("lets a FlowPanel error through to the page's auth boundary", async () => {
    await expect(
      readOrCard(site, async () => {
        throw new FlowpanelAccessError();
      }),
    ).rejects.toBeInstanceOf(FlowpanelAccessError);
  });

  it("lets a Next redirect keep travelling", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;/login" });
    await expect(
      readOrCard(site, async () => {
        throw redirect;
      }),
    ).rejects.toBe(redirect);
  });

  it("returns the value untouched when the read succeeds", async () => {
    expect(await readOrCard(site, async () => 42)).toEqual({ failed: false, value: 42 });
  });

  it("generates an id when the request context carries none", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const outcome = await readOrCard(site, async () => {
      throw new Error("no id");
    });
    expect(outcome.failed).toBe(true);
    expect(error.mock.calls[0]?.[0]).toMatch(/\(request [0-9a-f-]{36}\)/);
  });
});

describe("QueryErrorCard", () => {
  it("still reads as a sentence when the cause carries no message", () => {
    const config = admin(adapterThatFails("list", null));
    const text = textOf(
      QueryErrorCard({
        site: { config, resource: "orders", operation: "get", requestId: "r1" },
        cause: new Error(""),
      }),
    );
    expect(text).toContain("orders: get failed");
    expect(text).toContain("Request r1");
  });

  it("marks itself as a FlowPanel error surface for smoke tests", () => {
    const config = admin(adapterThatFails("list", null));
    const card = QueryErrorCard({
      site: { config, resource: "orders", operation: "get", requestId: "r1" },
      cause: new Error("boom"),
    });
    expect((card.props as { "data-fp-error"?: string })["data-fp-error"]).toBe("");
  });
});
