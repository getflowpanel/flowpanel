import type { RequestContext, ResolvedAdminConfig } from "@flowpanel/core";
import { kv, resolveFormatting } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { serializeCardWidget } from "../drawer/serialize-cards";
import { foldLongText } from "../runtime/kv-display";
import { kvItems } from "../runtime/widget-items";
import { fakeWidgetContext } from "./widget-context-fixture";

const cfg = {
  basePath: "/admin",
  resourcesByName: new Map(),
  __resolved: true,
} as unknown as ResolvedAdminConfig;
const reqCtx = {
  req: new Request("http://localhost/admin"),
  session: null,
  role: "admin",
  scope: null,
  ip: null,
  userAgent: null,
} as RequestContext;
const utc = resolveFormatting();

describe("foldLongText", () => {
  it("folds after the given number of lines and keeps the breaks", () => {
    expect(foldLongText("one\ntwo\nthree", 2)).toEqual({ head: "one\ntwo", rest: "three" });
    expect(foldLongText("one\ntwo", 2)).toEqual({ head: "one\ntwo" });
    expect(foldLongText(`${"a\n".repeat(6)}b`)).toEqual({ head: "a\na\na\na\na\na", rest: "b" });
  });

  it("cuts one long paragraph at a space before lines × 120 characters", () => {
    const text = Array.from({ length: 40 }, () => "word").join(" ");
    const { head, rest } = foldLongText(text, 1);
    expect(head.split(" ")).toHaveLength(24);
    expect(rest?.split(" ")).toHaveLength(16);
    expect(`${head} ${rest}`).toBe(text);
    const solid = foldLongText("x".repeat(300), 1);
    expect([solid.head.length, solid.rest?.length]).toEqual([120, 180]);
  });
});

describe("kv items", () => {
  it("folds a long value, prints empty text muted, and leaves other items alone", async () => {
    const items = await kvItems(
      kv({
        items: [
          { label: "Bio", value: "one\ntwo\nthree", long: { lines: 2 } },
          { label: "Short", value: "hi", long: true },
          { label: "Site", value: "  ", empty: "Not filled" },
          { label: "Plan", value: null },
        ],
      }).options,
      fakeWidgetContext(),
      utc,
      cfg,
    );
    expect(items).toEqual([
      { label: "Bio", value: "one\ntwo", long: true, rest: "three", more: "Show all" },
      { label: "Short", value: "hi", long: true },
      { label: "Site", value: "Not filled", tone: "muted" },
      { label: "Plan", value: "—" },
    ]);
  });

  it("sends the folded value to a drawer", async () => {
    const card = await serializeCardWidget(
      kv({ items: [{ label: "Bio", value: "a\nb", long: { lines: 1 } }] }),
      cfg,
      reqCtx,
      fakeWidgetContext(),
    );
    expect(card?.kind).toBe("kv");
    expect(card?.kind === "kv" ? card.items : []).toEqual([
      { label: "Bio", value: "a", long: true, rest: "b", more: "Show all" },
    ]);
  });
});
