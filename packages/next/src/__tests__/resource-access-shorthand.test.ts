import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish", () => ({
  publish: vi.fn(),
  publishResource: vi.fn(),
  bindPublisher: vi.fn(),
}));

import { drizzleAdapter } from "@flowpanel/adapter-drizzle";
import { type AccessRule, defineAdmin, type RequestContext, resource } from "@flowpanel/core";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { handlers } from "../handlers";
import { buildNav } from "../runtime/nav";

const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  body: text("body").notNull(),
});

const sqlite = new Database(":memory:");
const db = drizzle(sqlite);
let role = "support";

function admin(access: AccessRule) {
  return defineAdmin({
    adapter: drizzleAdapter({ db, schema: { notes }, dialect: "sqlite" }),
    auth: {
      session: async () => ({ id: "u1", role }),
      role: (session) => (session as { role: string } | null)?.role ?? "guest",
      access: ({ session }) => session !== null,
    },
    resources: [
      resource(notes, {
        access,
        columns: ["id", "body"],
        create: { fields: [{ name: "id" }, { name: "body" }] },
      }),
    ],
  });
}

const route = (...segments: string[]) => ({ params: Promise.resolve({ route: segments }) });
const json = (method: string, url: string, body?: unknown) =>
  new Request(`http://localhost/api/flowpanel/${url}`, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

/** The status of every JSON API operation on `notes`, in read, get, create, update, delete order. */
async function statuses(access: AccessRule): Promise<number[]> {
  const api = handlers(admin(access));
  return [
    (await api.GET(json("GET", "notes"), route("notes"))).status,
    (await api.GET(json("GET", "notes/n1"), route("notes", "n1"))).status,
    (await api.POST(json("POST", "notes", { id: "n2", body: "new" }), route("notes"))).status,
    (await api.PATCH(json("PATCH", "notes/n1", { body: "edited" }), route("notes", "n1"))).status,
    (await api.DELETE(json("DELETE", "notes/n1"), route("notes", "n1"))).status,
  ];
}

const rows = () => sqlite.prepare("SELECT id, body FROM notes ORDER BY id").all();

beforeEach(() => {
  sqlite.exec(
    "DROP TABLE IF EXISTS notes; CREATE TABLE notes (id TEXT PRIMARY KEY, body TEXT NOT NULL)",
  );
  sqlite.exec("INSERT INTO notes VALUES ('n1', 'first')");
});

afterAll(() => sqlite.close());

describe("a resource gated by one role", () => {
  it("refuses every operation to another role and writes nothing", async () => {
    role = "support";
    expect(await statuses("admin")).toEqual([403, 403, 403, 403, 403]);
    expect(rows()).toEqual([{ id: "n1", body: "first" }]);
  });

  it("admits every operation to that role", async () => {
    role = "admin";
    expect(await statuses("admin")).toEqual([200, 200, 200, 200, 200]);
    expect(rows()).toEqual([{ id: "n2", body: "new" }]);
  });

  it("hides the resource from the navigation of another role", async () => {
    role = "support";
    const reqCtx = { session: { role }, role, scope: undefined } as unknown as RequestContext;
    const groups = await buildNav(admin("admin"), reqCtx);
    expect(groups.flatMap((group) => group.items)).toEqual([]);
  });
});

describe("the other single-rule shorthands", () => {
  it("reads a list of roles as any of them", async () => {
    role = "support";
    expect(await statuses(["admin", "owner"])).toEqual([403, 403, 403, 403, 403]);
    role = "owner";
    expect((await statuses(["admin", "owner"]))[0]).toBe(200);
  });

  it("reads false as closed to everyone, the admin role included", async () => {
    role = "admin";
    expect(await statuses(false)).toEqual([403, 403, 403, 403, 403]);
    expect(rows()).toEqual([{ id: "n1", body: "first" }]);
  });

  it("asks a function for every operation", async () => {
    role = "support";
    const asked: string[] = [];
    const rule = ({ role: current }: { role: string }) => {
      asked.push(current);
      return current === "admin";
    };
    expect(await statuses(rule)).toEqual([403, 403, 403, 403, 403]);
    expect(asked.length).toBeGreaterThanOrEqual(5);
  });
});
