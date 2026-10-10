import type { Adapter, LabelsConfig } from "@flowpanel/core";
import { defineAdmin, FlowpanelAccessError, RU_LABELS, resource } from "@flowpanel/core";
import * as clientParts from "@flowpanel/next/client";
import { RefreshButton, RequestId } from "@flowpanel/next/client";
import * as ui from "@flowpanel/react";
import { PageHeader } from "@flowpanel/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResourceDetailPage } from "../pages/resource-detail";
import { ResourceListPage } from "../pages/resource-list";
import { FailureCard, type FailureCardProps } from "../runtime/failure-card";
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
    auth: {
      session: async () => ({ id: "u1" }),
      role: (session) => (session ? "admin" : "guest"),
      access: "admin",
    },
    ...(labels ? { labels } : {}),
    resources: [resource({ __name: "users" }, { columns: ["id", "email"] })],
  });
}

/** Browser components need a renderer; the card under test is server markup around them. */
const CLIENT = new Set<unknown>([...Object.values(clientParts), ...Object.values(ui)]);

/** Every string the tree would show, in order, without a DOM renderer. */
function textOf(tree: ReactNode): string {
  if (tree === null || tree === undefined || typeof tree === "boolean") return "";
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  if (Array.isArray(tree)) return tree.map(textOf).join(" ");
  if (!isValidElement(tree)) return "";
  const el = tree as ReactElement<{ children?: ReactNode; id?: string; label?: string }>;
  if (el.type === RequestId) return `Request ${el.props.id}`;
  if (el.type === RefreshButton) return el.props.label ?? "";
  if (el.type === clientParts.ListNavigationProvider) return textOf(el.props.children);
  if (CLIENT.has(el.type)) return "";
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
  it("says what could not load, keeps the page's header and offers a retry", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const text = await listText(adapterThatFails("list", new Error('column "emial" not found')));
    expect(text).toContain("Couldn't load users");
    expect(text).toContain(
      "Try again in a moment. If it keeps failing, send this ID to your developer.",
    );
    expect(text).toContain("Retry");
    expect(text).toContain("Check the column list and the database schema.");
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("keeps the list's header, search and filters above the card", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const config = admin(adapterThatFails("list", new Error("boom")));
    const users = config.resourcesByName.get("users");
    if (!users) throw new Error("fixture: resource not registered");
    const tree = await ResourceListPage({
      config,
      resource: users,
      searchParams: new URLSearchParams(),
      req: new Request("http://localhost/admin/users"),
    });
    expect(findType(tree, PageHeader)?.props.title).toBe("Users");
  });

  it("names developer hints only outside production", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "production");
    const text = await listText(adapterThatFails("list", new Error("boom")));
    expect(text).not.toContain("Check the column list");
    expect(text).toContain("Couldn't load users");
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
    expect(text).toContain("Couldn't load this user");
    expect(text).toContain("Request req-88");
  });

  it("says the database refused the connection instead of blaming the schema", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const refused = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), {
      code: "ECONNREFUSED",
    });
    const text = await listText(
      adapterThatFails("list", new Error("Failed query", { cause: refused })),
    );
    expect(text).toContain(
      "The database refused the connection or is unreachable. Check DATABASE_URL and that the server accepts connections.",
    );
    expect(text).not.toContain("Check the column list");
    expect(text).toContain("Request req-77");
  });

  it("keeps the details disclosure for a refused connection outside production", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "development");
    const text = await listText(
      adapterThatFails("list", new Error('password authentication failed for user "app"')),
    );
    expect(text).toContain("Details");
    expect(text).toContain('password authentication failed for user "app"');
  });

  it("speaks the admin's language", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const text = await listText(adapterThatFails("list", new Error("boom")), RU_LABELS);
    expect(text).toContain("Не удалось загрузить раздел «Users»");
    expect(text).toContain("Повторить");
  });
});

describe("what the card must not swallow", () => {
  const site: QuerySite = {
    config: admin(adapterThatFails("list", null)),
    resource: "users",
    operation: "list",
    label: "Users",
  };

  it("lets a FlowPanel error through to the page's auth boundary", async () => {
    await expect(
      readOrCard(site, async () => {
        throw new FlowpanelAccessError();
      }),
    ).rejects.toBeInstanceOf(FlowpanelAccessError);
  });

  it("lets a Next redirect keep travelling", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/login;307;",
    });
    await expect(
      readOrCard(site, async () => {
        throw redirect;
      }),
    ).rejects.toBe(redirect);
  });

  it("cards an ordinary error that happens to carry a digest", async () => {
    const outcome = await readOrCard(site, async () => {
      throw Object.assign(new Error("boom"), { digest: "2338412745" });
    });
    expect(outcome.failed).toBe(true);
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
        site: {
          config,
          resource: "orders",
          operation: "get",
          label: "Order",
          record: true,
          requestId: "r1",
        },
        cause: new Error(""),
      }),
    );
    expect(text).toContain("Couldn't load this order");
    expect(text).toContain("Request r1");
  });

  it("marks itself as a FlowPanel error surface for smoke tests", () => {
    const config = admin(adapterThatFails("list", null));
    const card = QueryErrorCard({
      site: { config, resource: "orders", operation: "get", label: "Order", requestId: "r1" },
      cause: new Error("boom"),
    });
    const frame = FailureCard(card.props as FailureCardProps);
    expect((frame.props as { "data-fp-error"?: string })["data-fp-error"]).toBe("");
  });

  it("keeps the cause behind a closed disclosure in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    const config = admin(adapterThatFails("list", null));
    const card = QueryErrorCard({
      site: { config, resource: "orders", operation: "list", label: "Orders", requestId: "r1" },
      cause: new Error('column "emial" does not exist'),
    });
    const details = findDetails(FailureCard(card.props as FailureCardProps));
    expect(details?.props.open).toBeUndefined();
    expect(textOf(details)).toContain("Details");
    expect(textOf(details)).toContain('column "emial" does not exist');
  });
});

function findType(tree: ReactNode, type: unknown): ReactElement<{ title?: unknown }> | undefined {
  if (Array.isArray(tree)) return tree.map((child) => findType(child, type)).find(Boolean);
  if (!isValidElement(tree)) return undefined;
  if (tree.type === type) return tree as ReactElement<{ title?: unknown }>;
  return findType((tree.props as { children?: ReactNode }).children, type);
}

function findDetails(tree: ReactNode): ReactElement<{ open?: boolean }> | undefined {
  if (Array.isArray(tree)) return tree.map(findDetails).find(Boolean);
  if (!isValidElement(tree)) return undefined;
  if (tree.type === "details") return tree as ReactElement<{ open?: boolean }>;
  return findDetails((tree.props as { children?: ReactNode }).children);
}
