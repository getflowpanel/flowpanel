import type { RequestContext } from "@flowpanel/core";
import { describe, expect, it, vi } from "vitest";
import { renderDetailFields } from "../detail-cells";

describe("renderDetailFields", () => {
  it("runs a render only for a field the projected row carries", async () => {
    const shown = vi.fn(() => "shown");
    const hidden = vi.fn(() => "leak");
    const rendered = await renderDetailFields(
      { name: "Ann" },
      [
        { name: "name", render: shown },
        { name: "secret", render: hidden },
      ],
      {} as RequestContext,
    );
    expect([...rendered]).toEqual([["name", "shown"]]);
    expect(hidden).not.toHaveBeenCalled();
  });

  it("logs a render that throws and leaves the field to its formatted value", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const rendered = await renderDetailFields(
      { plan: 7, name: "Ann" },
      [
        {
          name: "plan",
          render: async () => {
            throw new Error("plan deleted");
          },
        },
        { name: "name", render: () => "Ann" },
      ],
      {} as RequestContext,
    );
    expect([...rendered]).toEqual([["name", "Ann"]]);
    expect(String(error.mock.calls[0]?.[0])).toBe('[flowpanel] detail render failed for "plan"');
    error.mockRestore();
  });
});
