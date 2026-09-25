import type { Adapter, ColumnMeta, RequestContext, TimelineWidget } from "@flowpanel/core";
import {
  defineAdmin,
  isFilterInValue,
  isFilterRangeValue,
  resource,
  timeline,
  writeTimelineCursor,
} from "@flowpanel/core";
import type { TimelineCardProps } from "@flowpanel/react";
import type { ReactElement } from "react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderTimeline } from "../runtime/render-timeline";
import { buildWidgetContext, detailTabDateRange } from "../runtime/widget-context";

type Row = Record<string, unknown>;
const at = (iso: string) => new Date(iso);

const DATA: Record<string, Row[]> = {
  users: [{ id: "u1", name: "Ada" }],
  visits: [
    { id: "v1", userId: "u1", startedAt: at("2026-09-25T09:00:00Z") },
    { id: "v2", userId: "u2", startedAt: at("2026-09-25T09:30:00Z") },
  ],
  messages: [
    {
      id: "m1",
      userId: "u1",
      kind: "digest",
      text: "Digest",
      createdAt: at("2026-09-25T08:00:00Z"),
    },
    { id: "m2", userId: "u1", kind: "alert", text: "Alert", createdAt: at("2026-09-25T07:00:00Z") },
  ],
  notifications: [
    {
      id: "n1",
      userId: "u1",
      orderId: "o1",
      deliveredAt: at("2026-09-25T10:00:00Z"),
      failedReason: null,
      createdAt: at("2026-09-25T09:59:00Z"),
    },
    {
      id: "n2",
      userId: "u1",
      orderId: "o2",
      deliveredAt: null,
      failedReason: "blocked",
      createdAt: at("2026-09-25T06:00:00Z"),
    },
    {
      id: "n3",
      userId: "u2",
      orderId: "o2",
      deliveredAt: null,
      failedReason: "blocked",
      createdAt: at("2026-09-25T06:30:00Z"),
    },
  ],
  orders: [
    { id: "o1", title: "Logo" },
    { id: "o2", title: "Site" },
  ],
  secrets: [{ id: "s1", userId: "u1", at: at("2026-09-25T11:00:00Z") }],
};

const calls: Array<{ resource: string; filters: Row }> = [];

function time(value: unknown): number {
  return value instanceof Date ? value.getTime() : Number(value);
}

function matches(value: unknown, filter: unknown): boolean {
  if (filter === "__notnull__") return value !== null && value !== undefined;
  if (filter === "__null__") return value === null || value === undefined;
  if (isFilterInValue(filter)) return filter.values.includes(String(value));
  if (isFilterRangeValue(filter)) {
    if (value === null || value === undefined) return false;
    const v = time(value);
    return (
      (filter.gte === undefined || v >= time(filter.gte)) &&
      (filter.lte === undefined || v <= time(filter.lte))
    );
  }
  return String(value) === String(filter);
}

const meta = (name: string): ColumnMeta => ({
  name,
  type: "string",
  nullable: true,
  unique: name === "id",
  primaryKey: name === "id",
});

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: (ref) => {
    const name = (ref as { __name: string }).__name;
    return { name, columns: Object.keys(DATA[name]?.[0] ?? {}).map(meta), primaryKey: "id" };
  },
  inferSchema: () => ({}) as never,
  list: async (ref, ctx) => {
    const name = (ref as { __name: string }).__name;
    const { filters, sort, pageSize } = ctx as {
      filters: Row;
      sort: { field: string } | null;
      pageSize: number;
    };
    calls.push({ resource: name, filters });
    const rows = (DATA[name] ?? []).filter((row) =>
      Object.entries(filters).every(([f, v]) => matches(row[f], v)),
    );
    if (sort) rows.sort((a, b) => time(b[sort.field]) - time(a[sort.field]));
    return { rows: rows.slice(0, pageSize), total: rows.length, page: 1, pageSize };
  },
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

const toUser = { resource: "users", labelField: "name" };
const config = defineAdmin({
  adapter,
  auth: { session: async () => null, role: () => "admin" },
  resources: [
    resource({ __name: "users" }, { columns: ["id", "name"] }),
    resource(
      { __name: "visits" },
      { columns: ["id", { field: "userId", reference: toUser }, "startedAt"], detail: {} },
    ),
    resource(
      { __name: "messages" },
      { columns: ["id", { field: "userId", reference: toUser }, "kind", "text", "createdAt"] },
    ),
    resource(
      { __name: "notifications" },
      {
        columns: [
          "id",
          { field: "userId", reference: toUser },
          { field: "orderId", reference: { resource: "orders", labelField: "title" } },
          "deliveredAt",
          "failedReason",
          "createdAt",
        ],
      },
    ),
    resource({ __name: "orders" }, { columns: ["id", "title"], detail: {} }),
    resource(
      { __name: "secrets" },
      { columns: ["id", { field: "userId", reference: toUser }, "at"], access: { read: false } },
    ),
  ],
});

const reqCtx = (url: string): RequestContext => ({
  req: new Request(url),
  session: null,
  role: "admin",
  scope: null,
  ip: null,
  userAgent: null,
});

const Kinds = {
  visit: ["Visit", "info"],
  digest: "Digest",
  alert: ["Alert", "warn"],
  delivered: ["Delivered", "ok"],
  failed: ["Failed", "err"],
  secret: "Secret",
} as const;

const activity = timeline({
  id: "activity",
  kinds: Kinds,
  sources: [
    timeline.source("visits", { kind: "visit", at: "startedAt" }),
    timeline.source("messages", {
      kind: { field: "kind" },
      at: "createdAt",
      title: (m) => String(m.text),
    }),
    timeline.source("notifications", {
      kind: "delivered",
      at: "deliveredAt",
      refs: ["orderId"],
      title: (_n, refs) => `Delivered: ${refs.orderId}`,
    }),
    timeline.source("notifications", {
      kind: "failed",
      at: "createdAt",
      tone: "err",
      where: { failedReason: "__notnull__", deliveredAt: "__null__" },
      title: "Delivery failed",
    }),
    timeline.source("secrets", { kind: "secret", at: "at" }),
  ],
});

async function onCard(query = ""): Promise<TimelineCardProps> {
  const url = `http://localhost/admin/users/u1?tab=activity${query}`;
  const ctx = buildWidgetContext(
    config,
    reqCtx(url),
    new Request(url),
    detailTabDateRange(),
    DATA.users?.[0],
    "id",
    "users",
  );
  return (
    (await renderTimeline(
      activity as TimelineWidget,
      ctx,
      config,
      reqCtx(url),
    )) as ReactElement<TimelineCardProps>
  ).props;
}

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(at("2026-09-25T12:00:00Z"));
});
afterAll(() => vi.useRealTimers());
beforeEach(() => {
  calls.length = 0;
});

describe("timeline sources", () => {
  it("merges the record's rows of every readable source by time", async () => {
    const props = await onCard();
    const lines = props.groups.flatMap((g) => g.lines);
    expect(lines.map((l) => l.title)).toEqual([
      "Delivered: Logo",
      "Visit",
      "Digest",
      "Alert",
      "Delivery failed",
    ]);
    expect(lines.map((l) => l.href)).toEqual([
      "/admin/orders/o1",
      "/admin/visits/v1",
      undefined,
      undefined,
      undefined,
    ]);
    expect(lines[4]?.tone).toBe("err");
  });

  it("ANDs the record filter into a source with its own where", async () => {
    await onCard();
    const failed = calls.find(
      (c) => c.resource === "notifications" && c.filters.failedReason === "__notnull__",
    );
    expect(failed?.filters.userId).toBe("u1");
  });

  it("keeps the record filter when a where function names the referencing field", async () => {
    const url = "http://localhost/admin/users/u1?tab=activity";
    const ctx = buildWidgetContext(
      config,
      reqCtx(url),
      new Request(url),
      detailTabDateRange(),
      DATA.users?.[0],
      "id",
      "users",
    );
    const widened = timeline({
      kinds: Kinds,
      sources: [
        timeline.source("visits", {
          kind: "visit",
          at: "startedAt",
          where: () => ({ userId: "__notnull__" }),
        }),
      ],
    });
    const props = (
      (await renderTimeline(
        widened as TimelineWidget,
        ctx,
        config,
        reqCtx(url),
      )) as ReactElement<TimelineCardProps>
    ).props;
    expect(calls.find((c) => c.resource === "visits")?.filters.userId).toBe("u1");
    expect(props.groups.flatMap((g) => g.lines).map((l) => l.title)).toEqual(["Visit"]);
  });

  it("resolves a source's references in one read", async () => {
    await onCard();
    expect(calls.filter((c) => c.resource === "orders")).toHaveLength(1);
  });

  it("reads a kind column narrowed to the picked kinds, and skips fixed kinds not picked", async () => {
    const props = await onCard("&activity.kind=alert");
    const messages = calls.find((c) => c.resource === "messages");
    expect(messages?.filters.kind).toEqual({ op: "in", values: ["alert"] });
    expect(calls.some((c) => c.resource === "visits")).toBe(false);
    expect(props.groups.flatMap((g) => g.lines).map((l) => l.title)).toEqual(["Alert"]);
  });

  it("bounds a dashboard source by the picked range instead of a record", async () => {
    const url = "http://localhost/admin/pulse";
    const from = at("2026-09-25T09:00:00Z");
    const to = at("2026-09-25T12:00:00Z");
    const ctx = buildWidgetContext(config, reqCtx(url), new Request(url), {
      from,
      to,
      preset: "custom",
    });
    const visits = timeline({
      kinds: Kinds,
      sources: [timeline.source("visits", { kind: "visit", at: "startedAt" })],
    });
    const props = (
      (await renderTimeline(
        visits as TimelineWidget,
        ctx,
        config,
        reqCtx(url),
      )) as ReactElement<TimelineCardProps>
    ).props;
    expect(calls.find((c) => c.resource === "visits")?.filters).toEqual({
      startedAt: { op: "range", gte: from, lte: to },
    });
    expect(props.groups[0]?.count).toBe("2 events");
    expect(props.groups[0]?.lines[0]?.items).toHaveLength(2);
  });

  it("combines a host where bound on the at column with the page bound", async () => {
    const bounded = timeline({
      id: "activity",
      kinds: Kinds,
      sources: [
        timeline.source("visits", {
          kind: "visit",
          at: "startedAt",
          where: { startedAt: { gte: at("2026-09-25T09:15:00Z") } },
        }),
      ],
    });
    const cursor = writeTimelineCursor({ before: at("2026-09-25T09:45:00Z"), skip: 0 });
    const url = `http://localhost/admin/users/u1?tab=activity&activity.before=${encodeURIComponent(cursor)}`;
    const ctx = buildWidgetContext(
      config,
      reqCtx(url),
      new Request(url),
      detailTabDateRange(),
      DATA.users?.[0],
      "id",
      "users",
    );
    await renderTimeline(bounded as TimelineWidget, ctx, config, reqCtx(url));
    const visits = calls.find((c) => c.resource === "visits");
    expect(visits?.filters.startedAt).toEqual({
      op: "range",
      gte: at("2026-09-25T09:15:00Z"),
      lte: at("2026-09-25T09:45:00Z"),
    });
  });
});

describe("timeline source links follow each resource's own open mode", () => {
  const rows2: Record<string, Row[]> = {
    users2: [{ id: "u1" }],
    flags: [{ id: "f1", label: "Flag one" }],
    plainlogs: [{ id: "l1", label: "Log one" }],
    reports: [
      { id: "r1", userId: "u1", flagId: "f1", logId: "l1", openedAt: at("2026-09-25T05:30:00Z") },
      { id: "r2", userId: "u1", flagId: null, logId: "l1", openedAt: at("2026-09-25T05:20:00Z") },
    ],
  };
  const adapter2: Adapter = {
    kind: "drizzle",
    db: {},
    introspect: (ref) => {
      const name = (ref as { __name: string }).__name;
      return { name, columns: Object.keys(rows2[name]?.[0] ?? {}).map(meta), primaryKey: "id" };
    },
    inferSchema: () => ({}) as never,
    list: async (ref, ctx) => {
      const name = (ref as { __name: string }).__name;
      const { filters, sort, pageSize } = ctx as {
        filters: Row;
        sort: { field: string } | null;
        pageSize: number;
      };
      const list = (rows2[name] ?? []).filter((row) =>
        Object.entries(filters).every(([f, v]) => matches(row[f], v)),
      );
      if (sort) list.sort((a, b) => time(b[sort.field]) - time(a[sort.field]));
      return { rows: list.slice(0, pageSize), total: list.length, page: 1, pageSize };
    },
    get: async () => null,
    create: async () => ({}),
    update: async () => ({}),
    delete: async () => undefined,
  };
  const toUser2 = { resource: "users2", labelField: "id" };
  const cfg2 = defineAdmin({
    adapter: adapter2,
    auth: { session: async () => null, role: () => "admin" },
    resources: [
      resource({ __name: "users2" }, { columns: ["id"] }),
      resource({ __name: "flags" }, { columns: ["id", "label"], drawer: {} }),
      resource({ __name: "plainlogs" }, { columns: ["id", "label"] }),
      resource(
        { __name: "reports" },
        {
          columns: [
            "id",
            { field: "userId", reference: toUser2 },
            { field: "flagId", reference: { resource: "flags", labelField: "label" } },
            { field: "logId", reference: { resource: "plainlogs", labelField: "label" } },
            "openedAt",
          ],
          drawer: {},
        },
      ),
    ],
  });
  const flagKinds = { flagged: "Flagged", logged: "Logged" } as const;

  async function onCard2(w: TimelineWidget): Promise<TimelineCardProps> {
    const url = "http://localhost/admin/users2/u1?tab=activity";
    const ctx = buildWidgetContext(
      cfg2,
      reqCtx(url),
      new Request(url),
      detailTabDateRange(),
      rows2.users2?.[0],
      "id",
      "users2",
    );
    return ((await renderTimeline(w, ctx, cfg2, reqCtx(url))) as ReactElement<TimelineCardProps>)
      .props;
  }

  it("opens a drawer-mode source row's own link without the mount-path warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const w = timeline({
      kinds: flagKinds,
      sources: [
        timeline.source("reports", { kind: "logged", at: "openedAt", title: (r) => `Own ${r.id}` }),
      ],
    }) as TimelineWidget;
    const props = await onCard2(w);
    const lines = props.groups.flatMap((g) => g.lines);
    expect(lines).toHaveLength(2);
    for (const line of lines) expect(line.href).toContain("drawer=reports%3A");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("opens the first ref's own record following its resource's open mode", async () => {
    const w = timeline({
      kinds: flagKinds,
      sources: [
        timeline.source("reports", {
          kind: "flagged",
          at: "openedAt",
          refs: ["flagId"],
          title: (_r, refs) => `Flag ${refs.flagId}`,
        }),
      ],
    }) as TimelineWidget;
    const props = await onCard2(w);
    const line = props.groups.flatMap((g) => g.lines).find((l) => l.title === "Flag Flag one");
    expect(line?.href).toContain("drawer=flags%3Af1");
  });

  it("falls back to the row's own link when the first ref value is null", async () => {
    const w = timeline({
      kinds: flagKinds,
      sources: [
        timeline.source("reports", {
          kind: "flagged",
          at: "openedAt",
          refs: ["flagId"],
          title: (r) => `Row ${r.id}`,
        }),
      ],
    }) as TimelineWidget;
    const props = await onCard2(w);
    const line = props.groups.flatMap((g) => g.lines).find((l) => l.title === "Row r2");
    expect(line?.href).toContain("drawer=reports%3Ar2");
  });

  it("gives no href when the ref target has neither a detail page nor a drawer", async () => {
    const w = timeline({
      kinds: flagKinds,
      sources: [
        timeline.source("reports", {
          kind: "logged",
          at: "openedAt",
          refs: ["logId"],
          title: (r) => `Row ${r.id}`,
        }),
      ],
    }) as TimelineWidget;
    const props = await onCard2(w);
    const line = props.groups.flatMap((g) => g.lines).find((l) => l.title === "Row r1");
    expect(line?.href).toBeUndefined();
  });
});
