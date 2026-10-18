import type { AuditConfig, AuditLogEntry, AuditLogQuery, AuditLogStore } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { auditValueRoute } from "../actions/audit-value";
import {
  AUDIT_EVENT_PREVIEW,
  AUDIT_VALUE_PREVIEW,
  type AuditValuePreview,
  isAuditValuePreview,
  projectAuditDiff,
} from "../runtime/audit-view";
import { adapter } from "./detail-fixture";

const MB = "lorem ipsum ".repeat(90_000);
const UNBROKEN = "x".repeat(300_000);

const entry = (over: Partial<AuditLogEntry> = {}): AuditLogEntry => ({
  id: "e1",
  actorId: "u9",
  actorName: "Ann Lee",
  action: "users.update",
  resource: "users",
  targetId: "u1",
  diff: { before: { plan: "short", email: "a@b.c" }, after: { plan: MB, email: UNBROKEN } },
  at: new Date("2026-10-09T10:00:00Z"),
  ...over,
});

function previewOf(value: unknown): AuditValuePreview {
  if (!isAuditValuePreview(value)) throw new Error("expected a preview");
  return value;
}

function store(entries: AuditLogEntry[]) {
  const queries: Array<Pick<AuditLogQuery, "id" | "scope" | "visible">> = [];
  const log: AuditLogStore = {
    append: async () => {},
    list: async () => ({ entries: [], total: 0, capped: false }),
    entry: async (query) => {
      queries.push(query);
      const found = entries.find(
        (e) =>
          e.id === query.id &&
          (!query.visible || (e.resource !== null && query.visible.resources.includes(e.resource))),
      );
      return found ?? null;
    },
    facets: async () => ({ actors: [], actions: [] }),
  };
  return { log, queries };
}

function admin(
  log: AuditLogStore,
  { audit = { enabled: true }, scoped = false }: { audit?: AuditConfig; scoped?: boolean } = {},
) {
  return defineAdmin({
    adapter: { ...adapter, auditLog: log },
    auth: { session: async () => ({ id: "me" }), role: () => "support" },
    audit,
    ...(scoped ? { scope: () => ({ tenantId: "t1" }) } : {}),
    resources: [
      resource(
        { __name: "users" },
        {
          columns: ["id", "email", "plan", "spend"],
          fieldAccess: { email: { read: "admin" }, spend: { sensitive: true } },
          ...(scoped ? { scope: "bypass" as const } : {}),
        },
      ),
      resource(
        { __name: "payouts" },
        {
          columns: ["id"],
          access: { read: ["finance"] },
          ...(scoped ? { scope: "bypass" as const } : {}),
        },
      ),
    ],
  });
}

async function fetchValue(
  log: AuditLogStore,
  id: string,
  query: string,
  options: { audit?: AuditConfig; scoped?: boolean } = {},
) {
  const route = auditValueRoute(admin(log, options));
  const res = await route(
    new Request(`http://localhost/api/flowpanel/audit/${id}/value?${query}`),
    {
      params: Promise.resolve({ id }),
    },
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

describe("audit value previews", () => {
  const all = new Set(["plan", "email", "data"]);

  it("prints short values whole and cuts a long one to a bounded preview", () => {
    const [plan, email] = projectAuditDiff(entry().diff, all);
    expect(plan?.before).toBe("short");
    expect(plan?.after).toEqual({
      preview: true,
      text: MB.slice(0, AUDIT_VALUE_PREVIEW),
      length: MB.length,
    });
    expect(isAuditValuePreview(email?.after)).toBe(true);
    expect(previewOf(email?.after).text).toHaveLength(AUDIT_VALUE_PREVIEW);
  });

  it("reads a preview the store kept instead of the whole value", () => {
    const stored = { __flowpanelPreview: { text: "x".repeat(400), length: 300_000 } };
    const [change] = projectAuditDiff({ before: { plan: "a" }, after: { plan: stored } }, all);
    expect(change?.after).toEqual({ preview: true, text: "x".repeat(400), length: 300_000 });
  });

  it("keeps one event under its budget however many long fields it has", () => {
    const after = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`f${i}`, MB]));
    const fields = new Set(Object.keys(after));
    const changes = projectAuditDiff({ before: null, after }, fields);
    const sent = changes.reduce((sum, change) => sum + previewOf(change.after).text.length, 0);
    expect(sent).toBe(AUDIT_EVENT_PREVIEW);
    expect(changes.every((change) => isAuditValuePreview(change.after))).toBe(true);
    expect(previewOf(changes.at(-1)?.after).text).toBe("");
  });

  it("previews a long object as its JSON and never splits a surrogate pair or a CRLF", () => {
    const data = { rows: Array.from({ length: 80 }, (_, i) => ({ i })) };
    const [change] = projectAuditDiff({ before: null, after: { data } }, all);
    const preview = previewOf(change?.after);
    expect(JSON.stringify(data, null, 2).startsWith(preview.text)).toBe(true);
    expect(preview.length).toBe(JSON.stringify(data, null, 2).length);

    const emoji = `${"a".repeat(AUDIT_VALUE_PREVIEW - 1)}😀 and more ${"b".repeat(500)}`;
    const crlf = `${"a".repeat(AUDIT_VALUE_PREVIEW - 1)}\r\n${"b".repeat(500)}`;
    const [e, c] = projectAuditDiff({ before: null, after: { plan: emoji, email: crlf } }, all);
    expect(previewOf(e?.after).text).toHaveLength(AUDIT_VALUE_PREVIEW - 1);
    expect(previewOf(c?.after).text.endsWith("\r")).toBe(false);
  });
});

describe("GET /audit/:id/value", () => {
  it("answers one whole value the reader may see", async () => {
    const { log, queries } = store([entry()]);
    const { status, body } = await fetchValue(log, "e1", "field=plan&side=after");
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true, value: MB });
    expect(queries[0]).toMatchObject({ id: "e1" });
    expect(queries[0]?.visible).toEqual({ resources: ["users"], actions: [] });
  });

  it("reads the event under the reader's own tenant", async () => {
    const { log, queries } = store([entry()]);
    await fetchValue(log, "e1", "field=plan&side=after", { scoped: true });
    expect(queries[0]).toMatchObject({ id: "e1", scope: { key: '{"tenantId":"t1"}' } });
  });

  it("sends an object as indented JSON", async () => {
    const data = { a: [1, 2] };
    const { log } = store([entry({ diff: { before: null, after: { plan: data } } })]);
    const { body } = await fetchValue(log, "e1", "field=plan&side=after");
    expect(body.value).toBe(JSON.stringify(data, null, 2));
  });

  it("hides a field the reader may not read, a sensitive one and a missing side", async () => {
    const { log } = store([entry({ diff: { before: { spend: "t" }, after: { email: "x" } } })]);
    expect((await fetchValue(log, "e1", "field=email&side=after")).status).toBe(404);
    expect((await fetchValue(log, "e1", "field=spend&side=before")).status).toBe(404);
    expect((await fetchValue(log, "e1", "field=plan&side=after")).status).toBe(404);
  });

  it("hides an event of a resource the reader may not read", async () => {
    const payout = entry({
      id: "p1",
      resource: "payouts",
      action: "payouts.update",
      diff: { before: null, after: { amount: 5 } },
    });
    const { log } = store([payout]);
    expect((await fetchValue(log, "p1", "field=amount&side=after")).status).toBe(404);
  });

  it("refuses a bad side and a reader audit.access keeps out", async () => {
    const { log } = store([entry()]);
    expect((await fetchValue(log, "e1", "field=plan&side=middle")).status).toBe(400);
    const denied = await fetchValue(log, "e1", "field=plan&side=after", {
      audit: { enabled: true, access: "admin" },
    });
    expect(denied.status).toBe(403);
  });
});
