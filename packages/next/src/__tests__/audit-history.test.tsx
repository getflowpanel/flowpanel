import type {
  AuditConfig,
  AuditLogEntry,
  AuditLogQuery,
  AuditLogStore,
  ResourceOptions,
} from "@flowpanel/core";
import { DEFAULT_LABELS, dashboard, defineAdmin, resource } from "@flowpanel/core";
import {
  DASHBOARD_ACTION_PREFIX,
  DASHBOARD_AUDIT_RESOURCE,
  dashboardActionAudit,
} from "@flowpanel/core/internal";
import { AuditLogFilters, DetailTabsClient } from "@flowpanel/next/client";
import { describe, expect, it } from "vitest";
import { AuditFeed, type AuditFeedItem, auditFeedItems } from "../pages/audit/audit-feed";
import { AuditLogPage } from "../pages/audit/audit-log-page";
import { ResourceDetailPage } from "../pages/resource-detail";
import { auditVisibility, describeAuditAction, projectAuditDiff } from "../runtime/audit-view";
import { buildNav } from "../runtime/nav";
import { adapter, findAll } from "./detail-fixture";

type Row = Record<string, unknown>;

const entry = (over: Partial<AuditLogEntry> = {}): AuditLogEntry => ({
  id: "e1",
  actorId: "u9",
  actorName: "Ann Lee",
  action: "users.update",
  resource: "users",
  targetId: "u1",
  diff: {
    before: { plan: "free", spend: 10, email: "old@example.com" },
    after: { plan: "pro", spend: 10, email: "new@example.com" },
  },
  at: new Date("2026-10-09T10:00:00Z"),
  ...over,
});

/** A store that honours the visibility bound the way the SQL does. */
function store(entries: AuditLogEntry[] = [entry()]) {
  const queries: AuditLogQuery[] = [];
  const seen = (query: Pick<AuditLogQuery, "visible" | "resource">) =>
    entries.filter(
      (e) =>
        (query.resource === undefined || e.resource === query.resource) &&
        (!query.visible ||
          (e.resource !== null && query.visible.resources.includes(e.resource)) ||
          (e.resource === null && !e.action.startsWith(DASHBOARD_ACTION_PREFIX)) ||
          ((e.resource === null || e.resource === DASHBOARD_AUDIT_RESOURCE) &&
            query.visible.actions.includes(e.action))),
    );
  const log: AuditLogStore = {
    append: async () => {},
    list: async (query) => {
      queries.push(query);
      const shown = seen(query);
      return { entries: shown, total: shown.length, capped: false };
    },
    entry: async (query) => seen(query).find((e) => e.id === query.id) ?? null,
    facets: async (query) => ({
      actors: [...new Set(seen(query).map((e) => e.actorId ?? ""))].map((id) => ({
        id,
        name: null,
      })),
      actions: [...new Set(seen(query).map((e) => e.action))],
    }),
  };
  return { log, queries };
}

function config(
  users: ResourceOptions<Row>,
  {
    audit = { enabled: true },
    log = store().log,
    scoped = false,
  }: { audit?: AuditConfig; log?: AuditLogStore; scoped?: boolean } = {},
) {
  return defineAdmin({
    adapter: { ...adapter, auditLog: log },
    auth: { session: async () => ({ id: "me" }), role: () => "support" },
    audit,
    ...(scoped ? { scope: () => ({ tenantId: "t1" }) } : {}),
    resources: [
      resource({ __name: "users" }, { ...(scoped ? { scope: "bypass" } : {}), ...users }),
    ],
  });
}

async function page(admin: ReturnType<typeof config>, query = "") {
  const users = admin.resourcesByName.get("users");
  if (!users) throw new Error("users not registered");
  return ResourceDetailPage({
    config: admin,
    resource: users,
    name: "users",
    id: "u1",
    req: new Request(`http://localhost/admin/users/u1${query}`),
  });
}

function tabKeys(tree: unknown): string[] {
  const tabs = findAll(tree as never, DetailTabsClient)[0]?.tabs as
    | ReadonlyArray<{ key: string }>
    | undefined;
  return (tabs ?? []).map((tab) => tab.key);
}

const columns = ["id", "email", "plan", "spend"] as const;

describe("projectAuditDiff", () => {
  const allowed = new Set(["plan", "spend", "note"]);
  it("keeps changed, allowed fields of an update", () => {
    expect(projectAuditDiff(entry().diff, allowed)).toEqual([
      { field: "plan", before: "free", after: "pro" },
    ]);
  });

  it("shows every allowed field of a create or a delete on its one side", () => {
    expect(
      projectAuditDiff({ before: null, after: { plan: "pro", email: "a@b.c" } }, allowed),
    ).toEqual([{ field: "plan", before: undefined, after: "pro" }]);
    expect(projectAuditDiff({ before: { note: null }, after: null }, allowed)).toEqual([
      { field: "note", before: null, after: undefined },
    ]);
  });

  it("reads nothing from an event without a diff", () => {
    expect(projectAuditDiff(null, allowed)).toEqual([]);
  });
});

describe("describeAuditAction", () => {
  const admin = config({
    columns: [...columns],
    actions: [{ key: "refund", label: "Refund", run: async () => ({ ok: true }) }],
    bulkActions: [{ key: "archive", label: "Archive", run: async () => ({ ok: true }) }],
  });
  const audit = DEFAULT_LABELS.audit;
  const describe_ = (action: string, resource: string | null = "users") =>
    describeAuditAction(admin, { action, resource }, audit);

  it("names built-in writes and declared actions in the reader's words", () => {
    expect(describe_("users.create")).toBe("Created");
    expect(describe_("users.inline-update")).toBe("Updated");
    expect(describe_("users.restore")).toBe("Restored");
    expect(describe_("users.action.refund")).toBe("Ran Refund");
    expect(describe_("users.bulk.archive")).toBe("Ran Archive");
    expect(describe_("users.bulk.delete")).toBe("Deleted");
    expect(describe_("users.action.gone_now")).toBe("Ran Gone now");
    const sync = dashboardActionAudit("/", "sync");
    expect(describe_(sync.action, sync.resource)).toBe("Ran Sync");
  });
});

describe("dashboard actions that share a key", () => {
  const run = async () => ({ ok: true as const });
  const admin = defineAdmin({
    adapter,
    auth: { session: async () => ({ id: "me" }), role: () => "support" },
    resources: [resource({ __name: "users" }, { columns: [...columns] })],
    dashboards: [
      dashboard({
        path: "/billing",
        label: "Billing",
        access: "admin",
        sections: [],
        actions: [{ key: "sync", label: "Sync invoices", run }],
      }),
      dashboard({
        path: "/support",
        label: "Support",
        access: ["admin", "support"],
        sections: [],
        actions: [{ key: "sync", label: "Sync tickets", run }],
      }),
    ],
  });
  const billing = dashboardActionAudit("/billing", "sync");
  const support = dashboardActionAudit("/support", "sync");

  it("show a reader only the runs of the dashboard they may open", async () => {
    const visible = await auditVisibility(admin, {
      req: new Request("http://localhost/admin/audit-log"),
      session: { id: "me" },
      role: "support",
      scope: null,
      ip: null,
      userAgent: null,
    });
    expect(visible.actions).toEqual([support.action]);
    expect(billing.action).not.toBe(support.action);
  });

  it("are labelled by their own dashboard", () => {
    const audit = DEFAULT_LABELS.audit;
    expect(describeAuditAction(admin, billing, audit)).toBe("Ran Sync invoices");
    expect(describeAuditAction(admin, support, audit)).toBe("Ran Sync tickets");
  });
});

describe("the record History tab", () => {
  const users: ResourceOptions<Row> = {
    columns: [...columns],
    fieldAccess: { email: { read: "admin" }, spend: { sensitive: true } },
  };

  it("sits beside the fields when the audit table is on", async () => {
    expect(tabKeys(await page(config(users)))).toEqual(["details", "history"]);
  });

  it("lists the record's events with only the fields this reader may see", async () => {
    const { log, queries } = store([
      entry(),
      entry({ id: "e2", diff: { before: { spend: 1 }, after: { spend: 2 } } }),
    ]);
    const tree = await page(config(users, { log }), "?tab=history");
    expect(queries[0]).toMatchObject({ resource: "users", targetId: "u1", limit: 20, offset: 0 });
    expect(queries[0]).not.toHaveProperty("scope");
    expect(queries[0]?.visible).toEqual({ resources: ["users"], actions: [] });
    const items = findAll(tree, AuditFeed)[0]?.items as AuditFeedItem[];
    expect(items.map((item) => item.changes.map((change) => change.field))).toEqual([["plan"], []]);
    expect(items[0]?.verb).toBe("Updated");
  });

  it("reads only the caller's tenant under a global scope", async () => {
    const { log, queries } = store();
    await page(config(users, { log, scoped: true }), "?tab=history");
    expect(queries[0]?.scope).toEqual({ key: '{"tenantId":"t1"}' });
  });

  it("is hidden by detail.history, the resource's audit opt-out, audit.access or a sink", async () => {
    expect(tabKeys(await page(config({ ...users, detail: { history: false } })))).toEqual([]);
    expect(tabKeys(await page(config({ ...users, audit: false })))).toEqual([]);
    expect(tabKeys(await page(config(users, { audit: { access: "admin" } })))).toEqual([]);
    expect(tabKeys(await page(config(users, { audit: { sink: async () => {} } })))).toEqual([]);
  });

  it("joins declared tabs as the last one", async () => {
    const tree = await page(
      config({ ...users, detail: { tabs: [{ key: "facts", label: "Facts", fields: ["plan"] }] } }),
    );
    expect(tabKeys(tree)).toEqual(["facts", "history"]);
  });
});

describe("the Audit log nav entry", () => {
  const reqCtx = {
    req: new Request("http://localhost/admin"),
    session: { id: "me" },
    role: "support",
    scope: null,
    ip: null,
    userAgent: null,
  };

  it("appears for whom audit.access admits", async () => {
    const shown = await buildNav(config({ columns: [...columns] }), reqCtx);
    expect(shown.at(-1)?.items).toEqual([
      { label: "Audit log", href: "/admin/audit-log", icon: "history" },
    ]);
    const denied = await buildNav(
      config({ columns: [...columns] }, { audit: { access: "admin" } }),
      reqCtx,
    );
    expect(denied.flatMap((g) => g.items).some((i) => i.href === "/admin/audit-log")).toBe(false);
  });
});

describe("an event of a resource the reader may not read", () => {
  const payout = entry({
    id: "p1",
    action: "payouts.update",
    resource: "payouts",
    targetId: "42",
    diff: { before: { amount: 100 }, after: { amount: 5000 } },
  });
  const admin = (log: AuditLogStore) =>
    defineAdmin({
      adapter: { ...adapter, auditLog: log },
      auth: { session: async () => ({ id: "me" }), role: () => "support" },
      audit: { enabled: true },
      resources: [
        resource({ __name: "users" }, { columns: [...columns] }),
        resource({ __name: "payouts" }, { columns: ["id"], access: { read: ["finance"] } }),
      ],
    });
  const reqCtx = {
    req: new Request("http://localhost/admin/audit-log"),
    session: { id: "me" },
    role: "support",
    scope: null,
    ip: null,
    userAgent: null,
  };

  it("never reaches a support user: not in the log, its facets or the Resource filter", async () => {
    const { log, queries } = store([entry(), payout]);
    const tree = await AuditLogPage({
      config: admin(log),
      reqCtx,
      searchParams: new URLSearchParams("resource=payouts"),
    });
    expect(queries[0]?.visible).toEqual({ resources: ["users"], actions: [] });
    expect(findAll(tree, AuditFeed)).toEqual([]);
    const filters = findAll(tree, AuditLogFilters)[0] as {
      resources: Array<{ value: string }>;
      actions: Array<{ value: string }>;
    };
    expect(filters.resources.map((r) => r.value)).toEqual(["users"]);
    expect(filters.actions.map((a) => a.value)).toEqual(["users.update"]);
  });
});

describe("an audit event in the feed", () => {
  const reader = {
    requestId: "r1",
    req: new Request("http://localhost/admin/audit-log"),
    session: { id: "me" },
    role: "support",
    scope: null,
    ip: null,
    userAgent: null,
  };

  it("marks an old event whose diff was too large to preview, so its changes load on demand", async () => {
    const admin = config({ columns: [...columns] });
    const [item] = await auditFeedItems(
      admin,
      reader,
      [entry({ diff: null, diffTooLarge: true })],
      DEFAULT_LABELS.audit,
      { linkRecords: false },
    );
    expect(item?.tooLarge).toBe(true);
    expect(item?.changes).toEqual([]);
    const empty = () => ({ __flowpanelPreview: { text: "", length: 0 } });
    const [listed] = await auditFeedItems(
      admin,
      reader,
      [
        entry({
          diff: { before: { plan: empty() }, after: { plan: empty() } },
          diffTooLarge: true,
        }),
      ],
      DEFAULT_LABELS.audit,
      { linkRecords: false },
    );
    expect(listed?.tooLarge).toBe(true);
    expect(listed?.changes.map((change) => [change.field, change.long])).toEqual([["plan", true]]);
  });

  it("names an export by the list it exported, linked", async () => {
    const admin = config({ columns: [...columns] });
    const [item] = await auditFeedItems(
      admin,
      reader,
      [entry({ action: "users.export", targetId: null, diff: null })],
      DEFAULT_LABELS.audit,
      { linkRecords: true },
    );
    expect(item?.record).toEqual({ label: "Users", href: "/admin/users" });
  });

  it("reads a boolean change as yes or no in the admin's words", async () => {
    const admin = config({ columns: [...columns] });
    const [item] = await auditFeedItems(
      admin,
      reader,
      [entry({ diff: { before: { plan: true }, after: { plan: false } } })],
      DEFAULT_LABELS.audit,
      { linkRecords: false },
    );
    expect(item?.changes.map((change) => [change.before, change.after])).toEqual([["Yes", "No"]]);
  });

  it("labels a changed field as its form or drawer does when no column names it", async () => {
    const admin = config({
      columns: [...columns],
      drawer: { fields: [{ name: "plan", label: "Tarif" }] },
    });
    const [item] = await auditFeedItems(
      admin,
      reader,
      [entry({ diff: { before: { plan: true }, after: { plan: false } } })],
      DEFAULT_LABELS.audit,
      { linkRecords: false },
    );
    expect(item?.changes.map((change) => change.label)).toEqual(["Tarif"]);
  });

  it("names a record once when its title already says what it is", async () => {
    const admin = config({
      columns: [...columns],
      detail: { title: (row) => `User ${String(row.email)}` },
    });
    const [item] = await auditFeedItems(admin, reader, [entry()], DEFAULT_LABELS.audit, {
      linkRecords: true,
    });
    expect(item?.record?.label).toMatch(/^User [^U]/);
  });
});
