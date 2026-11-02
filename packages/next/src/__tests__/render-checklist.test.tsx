import type { ResolvedAdminConfig } from "@flowpanel/core";
import { checklist } from "@flowpanel/core";
import { ChecklistCard, type ChecklistCardProps } from "@flowpanel/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { renderChecklist } from "../runtime/render-checklist";
import { fakeWidgetContext } from "./widget-context-fixture";

const cfg = {
  paths: { admin: "/admin", api: "/api/flowpanel" },
  resourcesByName: new Map(),
  __resolved: true,
} as unknown as ResolvedAdminConfig;

async function props(widget: ReturnType<typeof checklist>): Promise<ChecklistCardProps> {
  const node = (await renderChecklist(
    widget,
    fakeWidgetContext(),
    cfg,
  )) as ReactElement<ChecklistCardProps>;
  expect(node.type).toBe(ChecklistCard);
  return node.props;
}

describe("renderChecklist", () => {
  it("dates ordered steps and measures the gap from the step before", async () => {
    const f = fakeWidgetContext().format;
    const p = await props(
      checklist({
        label: "Trace",
        ordered: true,
        layout: "steps",
        items: async () => [
          { label: "Published", done: "2026-09-24" },
          { label: "Seen", done: new Date("2026-09-24T10:00:00Z") },
          { label: "Scored", done: new Date("2026-09-24T10:05:00Z"), href: "/orders/o1" },
          { label: "Notified", done: null },
        ],
      }),
    );
    expect(p.label).toBe("Trace");
    expect(p.layout).toBe("steps");
    expect(p.summary).toEqual({ text: "3 of 4", share: 0.75 });
    expect(p.items.map((item) => [item.label, item.state, item.date, item.gap])).toEqual([
      ["Published", "done", f.date("2026-09-24"), undefined],
      ["Seen", "done", f.dateTime(new Date("2026-09-24T10:00:00Z")), undefined],
      ["Scored", "done", f.dateTime(new Date("2026-09-24T10:05:00Z")), `+${f.duration(300_000)}`],
      ["Notified", "todo", undefined, undefined],
    ]);
    expect(p.items[2]?.href).toBe("/orders/o1");
    expect(p.items.map((item) => item.mark)).toEqual(["Done", "Done", "Done", "Not done"]);
  });

  it("leaves optional items out of the summary and prints no dates unless ordered", async () => {
    const p = await props(
      checklist({
        items: [
          { label: "Email", done: "a@b.co" },
          { label: "Telegram", done: "", optional: true },
          { label: "Bio", done: false },
          { label: "Signed up", done: new Date("2026-09-01T00:00:00Z") },
        ],
      }),
    );
    expect(p.layout).toBe("list");
    expect(p.summary).toEqual({ text: "2 of 3", share: 2 / 3 });
    expect(p.items.map((item) => item.state)).toEqual(["done", "optional", "todo", "done"]);
    expect(p.items[1]?.mark).toBe("Optional");
    expect(p.items.every((item) => item.date === undefined)).toBe(true);
  });

  it("hides the summary on request and shows the empty state with no items", async () => {
    const p = await props(checklist({ summary: false, emptyState: "Nothing to check", items: [] }));
    expect(p.summary).toBeUndefined();
    expect(p.items).toEqual([]);
    expect(p.emptyState).toBe("Nothing to check");
  });
});
