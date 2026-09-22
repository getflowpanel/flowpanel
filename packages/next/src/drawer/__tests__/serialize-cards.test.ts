import type {
  RequestContext,
  ResolvedAdminConfig,
  WidgetConfig,
  WidgetContext,
} from "@flowpanel/core";
import { bars, DEFAULT_LABELS, funnel, kv, list, stat } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { serializeCardWidget } from "../serialize-cards";

const config = { formatting: undefined } as unknown as ResolvedAdminConfig;
const reqCtx: RequestContext = {
  req: new Request("http://localhost/"),
  session: null,
  role: "admin",
  scope: null,
  ip: null,
  userAgent: null,
};
const ctx: WidgetContext = {
  db: {},
  session: null,
  dateRange: { from: new Date(0), to: new Date(), preset: "custom" },
  req: reqCtx.req,
  row: { id: "u1" },
  href: () => "/admin",
  query: (_key, fn) => fn(),
  labels: DEFAULT_LABELS,
  sql: async () => [],
  count: async () => 0,
};

const serialize = (w: WidgetConfig) => serializeCardWidget(w, config, reqCtx, ctx);

describe("serializing card widgets for a drawer", () => {
  it("resolves a stat value against the row being viewed", async () => {
    const out = await serialize(stat("Record", async (c) => String(c.row?.id), { tone: "ok" }));
    expect(out).toEqual({ kind: "stat", label: "Record", value: "u1", tone: "ok" });
  });

  it("formats kv values on the server so the wire carries strings", async () => {
    const out = await serialize(
      kv({ label: "Facts", items: [{ label: "Share", value: 0.25, format: "percent" }] }),
    );
    expect(out).toMatchObject({ kind: "kv", label: "Facts" });
    expect((out as { items: { value: string }[] }).items[0]?.value).toContain("25");
  });

  it("renders a Date through the admin's formatting, in a stat and in a kv row", async () => {
    const zoned = { formatting: { timeZone: "Asia/Bangkok" } } as unknown as ResolvedAdminConfig;
    const joined = new Date("2026-09-22T23:30:00.000Z");
    const statOut = await serializeCardWidget(
      stat("Joined", async () => joined),
      zoned,
      reqCtx,
      ctx,
    );
    expect(statOut).toMatchObject({ value: "2026-09-23 06:30" });
    const kvOut = await serializeCardWidget(
      kv({ items: [{ label: "Joined", value: joined }] }),
      zoned,
      reqCtx,
      ctx,
    );
    expect((kvOut as { items: { value: string }[] }).items[0]?.value).toBe("2026-09-23 06:30");
  });

  it("carries bars, funnel and list rows with a resolved empty state", async () => {
    const barsOut = await serialize(bars({ query: async () => [{ label: "pro", value: 2 }] }));
    expect(barsOut).toEqual({
      kind: "bars",
      rows: [{ label: "pro", value: 2 }],
      emptyState: DEFAULT_LABELS.widget.empty,
    });
    const funnelOut = await serialize(funnel({ query: async () => [{ label: "a", value: 1 }] }));
    expect(funnelOut).toMatchObject({ kind: "funnel", steps: [{ label: "a", value: 1 }] });
    const listOut = await serialize(list({ query: async () => [{ text: "hi" }] }));
    expect(listOut).toMatchObject({ kind: "list", rows: [{ text: "hi" }] });
  });

  it("declines a kind it does not own", async () => {
    expect(await serialize({ kind: "weirdo", options: {} } as unknown as WidgetConfig)).toBeNull();
  });
});
