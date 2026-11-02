import type { AuditLogStore } from "@flowpanel/core";
import { dashboardActionAudit, storedAuditPreview } from "@flowpanel/core/internal";
import { expect } from "vitest";

/** What every adapter's `flowpanel_audit_log` store must do on a freshly migrated database. */
export async function expectAuditLogRoundTrip(store: AuditLogStore | undefined): Promise<void> {
  if (!store) throw new Error("the adapter has no auditLog");
  const at = new Date("2026-10-09T10:00:00.123Z");
  const later = new Date(at.getTime() + 60_000);
  await store.append({
    actorId: "u1",
    actorName: "Ann Lee",
    action: "orders.update",
    resource: "orders",
    targetId: "7",
    diff: { before: { total: 10, note: null }, after: { total: 12, note: "rush" } },
    scope: { tenantId: "t1" },
    ip: "203.0.113.9",
    userAgent: "vitest",
    at,
  });
  await store.append({
    actorId: "u2",
    action: "orders.bulk.archive",
    resource: "orders",
    targetId: "7,8",
    targetIds: ["7", "8"],
    scope: { tenantId: "t2" },
    at: later,
  });

  const tenant = await store.list({ scope: { key: '{"tenantId":"t1"}' }, limit: 10, offset: 0 });
  expect(tenant.total).toBe(1);
  expect(tenant.entries[0]).toMatchObject({
    actorId: "u1",
    actorName: "Ann Lee",
    action: "orders.update",
    resource: "orders",
    targetId: "7",
    diff: { before: { total: 10, note: null }, after: { total: 12, note: "rush" } },
  });
  expect(tenant.entries[0]?.at.toISOString()).toBe(at.toISOString());

  const record = await store.list({ resource: "orders", targetId: "7", limit: 10, offset: 0 });
  expect(record.entries.map((e) => e.action)).toEqual(["orders.bulk.archive", "orders.update"]);
  expect(record.entries[0]?.diff).toBeNull();

  const recent = await store.list({ from: new Date(at.getTime() + 1), limit: 1, offset: 1 });
  expect(recent.total).toBe(2);
  expect(recent.entries).toHaveLength(1);
  const earlier = await store.list({
    to: later,
    actorId: "u1",
    action: "orders.update",
    limit: 5,
    offset: 0,
  });
  expect(earlier.total).toBe(1);

  expect(await store.facets({ scope: { key: '{"tenantId":"t2"}' } })).toEqual({
    actors: [{ id: "u2", name: null }],
    actions: ["orders.bulk.archive"],
  });
  expect((await store.facets({ scope: { key: null } })).actions).toEqual([]);
  expect((await store.facets({})).actors.map((a) => a.id)).toEqual(["u2", "u1"]);

  const hidden = { visible: { resources: ["users"], actions: [] }, limit: 10, offset: 0 };
  expect(await store.list(hidden)).toEqual({ entries: [], total: 0, capped: false });
  expect(await store.facets({ visible: hidden.visible })).toEqual({ actors: [], actions: [] });
  const shown = await store.list({ ...hidden, visible: { resources: ["orders"], actions: [] } });
  expect(shown.total).toBe(3);

  const many = Array.from({ length: 10_000 }, (_, i) => `bulk-${i}`);
  await store.append({
    actorId: "u3",
    action: "orders.bulk.delete",
    resource: "orders",
    targetIds: many,
    at: later,
  });
  const bulk = await store.list({ actorId: "u3", limit: 1, offset: 0 });
  expect(bulk.total).toBe(10_000);
  const sync = dashboardActionAudit("/", "sync");
  await store.append({ actorId: "u4", ...sync, at: later });
  await store.append({ actorId: "u4", action: "session.signin", at: later });
  const none = { resources: [], actions: [] };
  const own = await store.list({ actorId: "u4", visible: none, limit: 10, offset: 0 });
  expect(own.entries.map((e) => e.action)).toEqual(["session.signin"]);
  const runs = { resources: [], actions: [sync.action] };
  expect((await store.list({ actorId: "u4", visible: runs, limit: 10, offset: 0 })).total).toBe(2);

  const big = "x".repeat(1_000_000);
  await store.append({
    actorId: "u5",
    action: "orders.update",
    resource: "orders",
    targetId: "9",
    diff: { before: { note: "short" }, after: { note: big } },
    scope: { tenantId: "t1" },
    at: later,
  });
  const [listed] = (await store.list({ actorId: "u5", limit: 1, offset: 0 })).entries;
  if (!listed) throw new Error("the large event was not listed");
  expect(JSON.stringify(listed.diff).length).toBeLessThan(600);
  const after = listed.diff?.after as Record<string, unknown> | undefined;
  expect(storedAuditPreview(after?.note)).toEqual({ text: "x".repeat(400), length: 1_000_000 });
  expect(listed.diff?.before).toEqual({ note: "short" });
  const tenant1 = { key: '{"tenantId":"t1"}' };
  const whole = await store.entry({ id: listed.id, scope: tenant1 });
  expect((whole?.diff?.after as Record<string, unknown> | undefined)?.note).toBe(big);
  expect(await store.entry({ id: listed.id, scope: { key: '{"tenantId":"t2"}' } })).toBeNull();
  const elsewhere = { resources: ["users"], actions: [] };
  expect(await store.entry({ id: listed.id, scope: tenant1, visible: elsewhere })).toBeNull();
}

const OLD_LARGE_NOTE = "z".repeat(20_000);

/** Two events a 0.3 table holds before its 0002 runs: one small enough to copy as its preview, one too large. */
export function oldAuditRows(dialect: "postgresql" | "mysql" | "sqlite"): string[] {
  const json = dialect === "postgresql" ? "::jsonb" : "";
  const small = JSON.stringify({ before: { note: "a" }, after: { note: "b" } });
  const large = JSON.stringify({ before: { note: "a" }, after: { note: OLD_LARGE_NOTE } });
  const odd = JSON.stringify([OLD_LARGE_NOTE]);
  return [
    ["old-small", small],
    ["old-large", large],
    ["old-odd", odd],
  ].map(
    ([target, diff]) =>
      `INSERT INTO flowpanel_audit_log (action, resource, target_id, diff) VALUES ('orders.update', 'orders', '${target}', '${diff}'${json})`,
  );
}

/** After the 0002: the small old event shows its diff; the large one is flagged and still reads whole. */
export async function expectOldRowsAfterUpgrade(store: AuditLogStore | undefined): Promise<void> {
  if (!store) throw new Error("the adapter has no auditLog");
  const page = (targetId: string) =>
    store.list({ resource: "orders", targetId, limit: 1, offset: 0 });
  const [small] = (await page("old-small")).entries;
  expect(small?.diff).toEqual({ before: { note: "a" }, after: { note: "b" } });
  expect(small?.diffTooLarge).toBeUndefined();
  const [large] = (await page("old-large")).entries;
  const unknown = { __flowpanelPreview: { text: "", length: 0 } };
  expect(large?.diff).toEqual({ before: { note: unknown }, after: { note: unknown } });
  expect(large?.diffTooLarge).toBe(true);
  const [odd] = (await page("old-odd")).entries;
  expect(odd?.diff).toEqual({ before: null, after: null });
  expect(odd?.diffTooLarge).toBe(true);
  const whole = await store.entry({ id: large?.id ?? "" });
  expect((whole?.diff?.after as Record<string, unknown> | undefined)?.note).toBe(OLD_LARGE_NOTE);
}
