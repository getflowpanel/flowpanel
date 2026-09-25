import type { Adapter, WidgetConfig } from "@flowpanel/core";
import { custom, defineAdmin, metric, resource } from "@flowpanel/core";
import { RealtimeRefresh } from "@flowpanel/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { adminWidgetContext, cardProps, resolveWidget } from "../runtime/resolve-widget";
import { fakeWidgetContext } from "./widget-context-fixture";

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: (ref) => ({
    name: (ref as { __name: string }).__name,
    columns: [],
    primaryKey: "id",
  }),
  inferSchema: () => ({}) as never,
  list: async () => ({ rows: [], total: 7, page: 1, pageSize: 1 }),
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

const admin = defineAdmin({
  adapter,
  auth: { session: async () => null, role: () => "admin" },
  paths: { admin: "/ops" },
  resources: [
    resource({ __name: "runs" }, { columns: ["id"] }),
    resource({ __name: "users" }, { columns: ["id"], rowKey: "uid" }),
  ],
});

function Conveyor(_props: { stages: number }) {
  return null;
}

function Card(_props: { value: number }) {
  return null;
}

function Frame({ children }: { children: ReactNode }) {
  return <section>{children}</section>;
}

async function Late({ children }: { children: ReactNode }) {
  return <Frame>{children}</Frame>;
}

async function Prompts(_props: { id: number }): Promise<ReactNode> {
  throw new Error("a custom widget's own component is never run by resolveWidget");
}

describe("adminWidgetContext", () => {
  it("counts through the admin, under its mount", async () => {
    const ctx = adminWidgetContext(admin);
    expect(await ctx.count("runs")).toBe(7);
    expect(ctx.link({ resource: "runs", id: 3 })).toBe("/ops/runs/3");
    expect(ctx.dateRange.previous).toBeNull();
  });

  it("names the record by the resource's rowKey", () => {
    const ctx = adminWidgetContext(admin, { resource: "users", row: { uid: 9, name: "Ada" } });
    expect(ctx.id).toBe("9");
    expect(ctx.row).toEqual({ uid: 9, name: "Ada" });
  });

  it("hands a picked range its previous period", () => {
    const ctx = adminWidgetContext(admin, {
      range: { from: new Date("2026-09-22T00:00:00Z"), to: new Date("2026-09-25T00:00:00Z") },
    });
    expect(ctx.dateRange.previous).not.toBeNull();
  });
});

describe("resolveWidget", () => {
  it("returns the props the metric card receives", async () => {
    const widget = metric("Runs", async (c) => c.count("runs"), {
      sublabel: "today",
      drilldown: { resource: "runs" },
    });
    const resolved = await resolveWidget(widget, adminWidgetContext(admin));
    expect(resolved.kind).toBe("metric");
    expect(resolved.props).toMatchObject({
      label: "Runs",
      value: 7,
      sublabel: "today",
      drilldown: "/ops/runs",
    });
  });

  it("returns a custom widget's own props, not its frame's", async () => {
    const widget = custom(Conveyor, async () => ({ stages: 4 }), { label: "Конвейер" });
    const resolved = await resolveWidget(widget as WidgetConfig, adminWidgetContext(admin));
    expect(resolved.props).toEqual({ stages: 4 });
  });

  it("lets a failing query reject, so the test names it", async () => {
    const widget = metric("Broken", async () => {
      throw new Error('relation "runz" does not exist');
    });
    await expect(resolveWidget(widget, adminWidgetContext(admin))).rejects.toThrow("runz");
  });

  it("refuses a hand-built context, which carries no admin", async () => {
    await expect(
      resolveWidget(
        metric("Runs", async () => 1),
        fakeWidgetContext(),
      ),
    ).rejects.toThrow("resolveWidget needs a context from adminWidgetContext()");
  });
});

describe("cardProps", () => {
  it("looks through frames, awaits an async wrapper, and skips the realtime listener", async () => {
    const tree = (
      <>
        <Late>
          <Card value={3} />
        </Late>
        <RealtimeRefresh channels="runs" />
      </>
    );
    expect(await cardProps(tree)).toEqual({ value: 3 });
  });

  it("finds the named component without running it", async () => {
    const tree = (
      <Frame>
        <Prompts id={2} />
      </Frame>
    );
    expect(await cardProps(tree, Prompts)).toEqual({ id: 2 });
  });
});
