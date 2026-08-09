import { describe, expect, it } from "vitest";
import type { Adapter, ColumnMeta } from "../index.js";
import { defineAdmin, queue, resource } from "../index.js";

function meta(name: string): ColumnMeta {
  return { name, type: "string", nullable: false, unique: false, primaryKey: name === "id" };
}

function makeAdapter(introspect: Adapter["introspect"]): Adapter {
  return {
    kind: "drizzle",
    db: {},
    introspect,
    inferSchema: () =>
      ({ create: {}, update: {}, select: {} }) as unknown as ReturnType<Adapter["inferSchema"]>,
    list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
    get: async () => null,
    create: async () => ({}),
    update: async () => ({}),
    delete: async () => undefined,
  };
}

const withColumns = (names: string[]): Adapter =>
  makeAdapter(() => ({ name: "users", columns: names.map(meta), primaryKey: "id" }));

const blind = makeAdapter(() => ({ name: "users", columns: [], primaryKey: "id" }));

const broken = makeAdapter(() => {
  throw new Error("cannot resolve ref");
});

const auth = { session: async () => null, role: () => "guest" };

describe("defineAdmin — reserved route segments", () => {
  it.each(["dashboards", "drawer", "queues"])("rejects a resource named %s", (name) => {
    expect(() =>
      defineAdmin({
        adapter: withColumns(["id"]),
        auth,
        resources: [resource({ __name: name }, { columns: ["id"] })],
      }),
    ).toThrow(new RegExp(`resource "${name}" uses a name FlowPanel's routing reserves`));
  });

  it("points the operator at options.name", () => {
    expect(() =>
      defineAdmin({
        adapter: withColumns(["id"]),
        auth,
        resources: [resource({ __name: "drawer" }, { columns: ["id"] })],
      }),
    ).toThrow(/Set options.name to something else/);
  });

  it("rejects a queue whose key is reserved, pointing at options.key", () => {
    expect(() =>
      defineAdmin({
        adapter: blind,
        auth,
        queues: [
          queue(
            { name: "dashboards" },
            { label: "Dashboards", boardUrl: "http://localhost:3001/d" },
          ),
        ],
      }),
    ).toThrow(/queue "dashboards" uses a name FlowPanel's routing reserves.*Set options.key/s);
  });

  it("leaves an unreserved name alone", () => {
    const config = defineAdmin({
      adapter: withColumns(["id"]),
      auth,
      resources: [resource({ __name: "dashboard" }, { columns: ["id"] })],
    });
    expect(config.resourcesByName.has("dashboard")).toBe(true);
  });
});

describe("defineAdmin — columns default to the introspection", () => {
  it("fills omitted columns in introspection order", () => {
    const config = defineAdmin({
      adapter: withColumns(["id", "email", "createdAt"]),
      auth,
      resources: [resource({ __name: "users" }, {})],
    });
    expect(config.resourcesByName.get("users")?.options.columns).toEqual([
      "id",
      "email",
      "createdAt",
    ]);
    expect(config.resources?.[0]?.options.columns).toEqual(["id", "email", "createdAt"]);
  });

  it("keeps declared columns untouched", () => {
    const config = defineAdmin({
      adapter: withColumns(["id", "email"]),
      auth,
      resources: [resource({ __name: "users" }, { columns: ["email"] })],
    });
    expect(config.resourcesByName.get("users")?.options.columns).toEqual(["email"]);
  });

  it("fills columns under readOnly too", () => {
    const config = defineAdmin({
      adapter: withColumns(["id", "email"]),
      auth,
      readOnly: true,
      resources: [resource({ __name: "users" }, {})],
    });
    expect(config.resourcesByName.get("users")?.options.columns).toEqual(["id", "email"]);
  });

  it("throws when columns are omitted and introspect throws", () => {
    expect(() =>
      defineAdmin({ adapter: broken, auth, resources: [resource({ __name: "users" }, {})] }),
    ).toThrow(/resource "users" omits options\.columns.*Declare options\.columns explicitly/s);
  });

  it("throws when columns are omitted and the introspection reports none", () => {
    expect(() =>
      defineAdmin({ adapter: blind, auth, resources: [resource({ __name: "users" }, {})] }),
    ).toThrow(/resource "users" omits options\.columns.*Declare options\.columns explicitly/s);
  });

  it("still accepts an explicitly empty columns list", () => {
    const config = defineAdmin({
      adapter: blind,
      auth,
      resources: [resource({ __name: "users" }, { columns: [] })],
    });
    expect(config.resourcesByName.get("users")?.options.columns).toEqual([]);
  });
});

describe("defineAdmin — introspect-time column validation", () => {
  const adapter = withColumns(["id", "email", "ai_usage", "createdAt"]);

  it("rejects an unknown bare column, listing the known ones", () => {
    expect(() =>
      defineAdmin({
        adapter,
        auth,
        resources: [resource({ __name: "users" }, { columns: ["emial"] })],
      }),
    ).toThrow(
      /resource "users" points at column "emial" via columns\[0\].*Known columns: "id", "email", "ai_usage", "createdAt"\./s,
    );
  });

  it("suggests a near miss across casing and underscores", () => {
    expect(() =>
      defineAdmin({
        adapter,
        auth,
        resources: [resource({ __name: "users" }, { columns: ["aiUsage"] })],
      }),
    ).toThrow(/Did you mean "ai_usage"\?/);
  });

  it("rejects an unknown ColumnDef.field", () => {
    expect(() =>
      defineAdmin({
        adapter,
        auth,
        resources: [
          resource({ __name: "users" }, { columns: ["id", { field: "nope", label: "Nope" }] }),
        ],
      }),
    ).toThrow(/points at column "nope" via columns\[1\]\.field/);
  });

  it("skips a field-less render column", () => {
    const config = defineAdmin({
      adapter,
      auth,
      resources: [
        resource(
          { __name: "users" },
          { columns: ["id", { label: "Actions", render: () => null }] },
        ),
      ],
    });
    expect(config.resourcesByName.size).toBe(1);
  });

  it("rejects an unknown defaultSort.field", () => {
    expect(() =>
      defineAdmin({
        adapter,
        auth,
        resources: [
          resource(
            { __name: "users" },
            { columns: ["id"], defaultSort: { field: "made-up", dir: "asc" } },
          ),
        ],
      }),
    ).toThrow(/points at column "made-up" via defaultSort\.field/);
  });

  it("rejects an unknown filter field", () => {
    expect(() =>
      defineAdmin({
        adapter,
        auth,
        resources: [
          resource(
            { __name: "users" },
            { columns: ["id"], filters: [{ field: "ghost", type: "text" }] },
          ),
        ],
      }),
    ).toThrow(/points at column "ghost" via filters\[0\]\.field/);
  });

  it("rejects an unknown create.fields name", () => {
    expect(() =>
      defineAdmin({
        adapter,
        auth,
        resources: [
          resource(
            { __name: "users" },
            { columns: ["id"], create: { fields: [{ name: "emial" }] } },
          ),
        ],
      }),
    ).toThrow(/points at column "emial" via create\.fields\[0\]\.name/);
  });

  it("rejects an unknown update.fields name", () => {
    expect(() =>
      defineAdmin({
        adapter,
        auth,
        resources: [
          resource(
            { __name: "users" },
            { columns: ["id"], update: { fields: [{ name: "emial" }] } },
          ),
        ],
      }),
    ).toThrow(/points at column "emial" via update\.fields\[0\]\.name/);
  });

  it("skips validation when the adapter reports no columns", () => {
    const config = defineAdmin({
      adapter: blind,
      auth,
      resources: [resource({ __name: "users" }, { columns: ["whatever"] })],
    });
    expect(config.resourcesByName.get("users")?.options.columns).toEqual(["whatever"]);
  });

  it("skips validation when introspect throws", () => {
    const config = defineAdmin({
      adapter: broken,
      auth,
      resources: [resource({ __name: "users" }, { columns: ["whatever"] })],
    });
    expect(config.resourcesByName.get("users")?.options.columns).toEqual(["whatever"]);
  });
});

describe("defineAdmin — duplicate action keys", () => {
  const adapter = withColumns(["id"]);
  const run = async () => ({ ok: true }) as const;

  it("rejects two row actions with the same key", () => {
    expect(() =>
      defineAdmin({
        adapter,
        auth,
        resources: [
          resource(
            { __name: "users" },
            {
              columns: ["id"],
              actions: [
                { key: "ping", label: "Ping", run },
                { key: "ping", label: "Ping again", run },
              ],
            },
          ),
        ],
      }),
    ).toThrow(/Duplicate action key: "ping" in resource "users" options\.actions/);
  });

  it("rejects two bulk actions with the same key", () => {
    expect(() =>
      defineAdmin({
        adapter,
        auth,
        resources: [
          resource(
            { __name: "users" },
            {
              columns: ["id"],
              bulkActions: [
                { key: "archive", label: "Archive", run },
                { key: "archive", label: "Archive again", run },
              ],
            },
          ),
        ],
      }),
    ).toThrow(/Duplicate action key: "archive" in resource "users" options\.bulkActions/);
  });

  it("rejects two drawer actions with the same key", () => {
    expect(() =>
      defineAdmin({
        adapter,
        auth,
        resources: [
          resource(
            { __name: "users" },
            {
              columns: ["id"],
              drawer: {
                actions: [
                  { key: "disable", label: "Disable", run },
                  { key: "disable", label: "Disable again", run },
                ],
              },
            },
          ),
        ],
      }),
    ).toThrow(/Duplicate action key: "disable" in resource "users" options\.drawer\.actions/);
  });

  it("still rejects duplicates when readOnly strips the actions", () => {
    expect(() =>
      defineAdmin({
        adapter,
        auth,
        readOnly: true,
        resources: [
          resource(
            { __name: "users" },
            {
              columns: ["id"],
              actions: [
                { key: "ping", label: "Ping", run },
                { key: "ping", label: "Ping again", run },
              ],
            },
          ),
        ],
      }),
    ).toThrow(/Duplicate action key: "ping"/);
  });

  it("accepts the same key in two different lists", () => {
    const config = defineAdmin({
      adapter,
      auth,
      resources: [
        resource(
          { __name: "users" },
          {
            columns: ["id"],
            actions: [{ key: "sync", label: "Sync", run }],
            bulkActions: [{ key: "sync", label: "Sync", run }],
          },
        ),
      ],
    });
    expect(config.resourcesByName.size).toBe(1);
  });
});

describe("defineAdmin — message shape", () => {
  it("duplicate queue keys read like the other duplicate checks", () => {
    expect(() =>
      defineAdmin({
        adapter: blind,
        auth,
        queues: [
          queue({ name: "emails" }, { label: "Emails", boardUrl: "http://localhost:3001/e" }),
          queue(
            { name: "emails" },
            { label: "Emails again", boardUrl: "http://localhost:3001/e2" },
          ),
        ],
      }),
    ).toThrow(/Duplicate queue key: "emails"\. Each queue key must be unique\./);
  });

  it("an unresolvable ref is described in the error", () => {
    const sym = Symbol("mystery");
    expect(() =>
      defineAdmin({
        adapter: blind,
        auth,
        resources: [resource({ id: 1, [sym]: "x" } as never, { columns: [] })],
      }),
    ).toThrow(
      /Unable to resolve a resource name from this ref: object with keys \[id\] and symbols \[Symbol\(mystery\)\].*Pass options\.name explicitly/s,
    );
  });

  it("names the ref type for a primitive ref", () => {
    expect(() =>
      defineAdmin({ adapter: blind, auth, resources: [resource("", { columns: [] })] }),
    ).toThrow(/Unable to resolve a resource name from this ref: string ""/);
  });
});
