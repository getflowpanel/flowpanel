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
});
