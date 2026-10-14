import { describe, expect, it } from "vitest";
import { withClerk } from "../auth/clerk";
import type { Adapter, ColumnMeta } from "../index";
import { dashboard, defineAdmin, page, queue, resource } from "../index";

const meta = (name: string): ColumnMeta => ({
  name,
  type: "string",
  nullable: false,
  unique: false,
  primaryKey: name === "id",
});

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: () => ({ name: "users", columns: ["id", "email"].map(meta), primaryKey: "id" }),
  inferSchema: () =>
    ({ create: {}, update: {}, select: {} }) as unknown as ReturnType<Adapter["inferSchema"]>,
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

const define = (options: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  defineAdmin({
    adapter,
    resources: [resource({ __name: "users" }, { columns: ["email"], ...options } as never)],
    ...extra,
  } as never);

describe("a config that gates access with requireRole where only access is read", () => {
  it("fails at boot on a resource instead of leaving it open", () => {
    expect(() => define({ requireRole: "admin" })).toThrow(/users.*requireRole.*access/);
  });

  it("fails at boot on a row, bulk or drawer action", () => {
    const action = { key: "ban", label: "Ban", requireRole: "admin", handler: async () => {} };
    expect(() => define({ actions: [action] })).toThrow(/users.*ban.*requireRole.*access/);
    expect(() => define({ bulkActions: [action] })).toThrow(/ban.*requireRole/);
    expect(() => define({ drawer: { actions: [action] } })).toThrow(/ban.*requireRole/);
  });

  it("fails at boot on a dashboard action", () => {
    const board = dashboard({
      path: "/",
      label: "Overview",
      sections: [],
      actions: [{ key: "sync", label: "Sync", requireRole: "admin", handler: async () => {} }],
    } as never);
    expect(() => define({}, { dashboards: [board] })).toThrow(/sync.*requireRole.*access/);
  });

  it("fails at boot on a dashboard, a page or a queue", () => {
    const board = dashboard({ path: "/", label: "Overview", requireRole: "admin" } as never);
    expect(() => define({}, { dashboards: [board] })).toThrow(
      /dashboard "\/".*requireRole.*access/,
    );
    const help = page({ path: "/help", label: "Help", href: "/x", requireRole: "admin" } as never);
    expect(() => define({}, { pages: [help] })).toThrow(/page "\/help".*requireRole.*access/);
    const jobs = queue({ name: "jobs" }, {
      label: "Jobs",
      boardUrl: "/b",
      requireRole: "admin",
    } as never);
    expect(() => define({}, { queues: [jobs] })).toThrow(/queue "jobs".*requireRole.*access/);
  });

  it("fails at boot on a form field and names its fieldAccess entry", () => {
    const fields = [{ name: "email", requireRole: "admin" }];
    expect(() => define({ create: { fields } })).toThrow(
      /users" create field "email".*requireRole.*fieldAccess\.email/,
    );
    expect(() => define({ update: { fields } })).toThrow(/update field "email"/);
  });

  it("names the new argument when the removed requireRole was a function", () => {
    const auth = {
      session: async () => null,
      role: () => "guest",
      requireRole: (s: unknown) => s !== null,
    };
    expect(() => define({}, { auth })).toThrow(
      /auth\.access instead\. A rule function receives \{ session, role, scope \}, not the session: write \(\{ session \}\) => session !== null/,
    );
    const board = dashboard({ path: "/", label: "Overview", requireRole: () => true } as never);
    expect(() => define({}, { dashboards: [board] })).toThrow(
      /receives \{ session, role, scope \}/,
    );
    expect(() => withClerk({ requireRole: (s: unknown) => !!s } as never)).toThrow(
      /withClerk requireRole: requireRole was removed.*\(\{ session \}\) => session !== null/,
    );
    expect(() => define({}, { auth: { ...auth, requireRole: "admin" } })).not.toThrow(
      /receives \{ session/,
    );
  });

  it("says an action form field's requireRole never gated anything", () => {
    const action = {
      key: "ban",
      label: "Ban",
      form: [{ name: "reason", requireRole: "admin" }],
      run: async () => ({ ok: true }),
    };
    expect(() => define({ actions: [action] })).toThrow(
      /action "ban" field "reason" requireRole: requireRole never gated.*gate the whole action with access/,
    );
  });

  it("fails at boot on auth.requireRole and on an auth adapter given requireRole", () => {
    const auth = { session: async () => null, role: () => "guest", requireRole: "admin" };
    expect(() => define({}, { auth })).toThrow(/auth requireRole: .*auth\.access/);
    expect(() => withClerk({ requireRole: "admin" } as never)).toThrow(
      /withClerk requireRole: requireRole was removed.*access/,
    );
  });
});

describe("options that were renamed", () => {
  it("fail at boot instead of being ignored", () => {
    expect(() => define({ detail: { header: () => "x" } })).toThrow(
      /users.*detail\.header.*detail\.title/,
    );
    expect(() => define({ drawer: { header: () => "x" } })).toThrow(
      /users.*drawer\.header.*drawer\.title/,
    );
    expect(() => define({}, { basePath: "/ops" })).toThrow(/basePath.*paths\.admin/);
    const run = async () => ({ ok: true as const });
    expect(() =>
      define({ drawer: { actions: [{ key: "flag", label: "Flag", palette: true, run }] } }),
    ).toThrow(/drawer action "flag" palette/);
  });

  it("fail at boot for labels 0.4 moved into a group, naming the new place", () => {
    expect(() => define({}, { labels: { noResults: "Пусто" } })).toThrow(/table\.noResults/);
    expect(() => define({}, { labels: { allOption: "Все" } })).toThrow(/filters\.allOption/);
    expect(() => define({}, { labels: { searchPlaceholder: "x" } })).toThrow(
      /table\.searchPlaceholder/,
    );
    expect(() => define({}, { labels: { formError: "x" } })).toThrow(/form\.error/);
    expect(() => define({}, { labels: { errors: { queryTitle: "x" } } })).toThrow(/loadTitle/);
  });
});

describe("resolveOperationAccess", () => {
  it("rejects anything but a resource operation, so a stale call cannot read as allowed", async () => {
    const { resolveOperationAccess } = await import("../policy/access");
    expect(resolveOperationAccess({ read: "admin" }, "read")).toBe("admin");
    expect(() => resolveOperationAccess({ read: "admin" }, undefined as never)).toThrow(
      /Unknown resource operation/,
    );
  });
});
