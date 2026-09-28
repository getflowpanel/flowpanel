import { bars, OTHER_KEY } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { barRows } from "../runtime/bar-rows";
import { fakeWidgetContext } from "./widget-context-fixture";

describe("barRows", () => {
  it("names the folded rest in the admin's words and leaves other rows alone", async () => {
    const widget = bars({
      query: async () => [
        { key: "kwork", label: "Kwork", value: 3 },
        { key: OTHER_KEY, label: OTHER_KEY, value: 2 },
      ],
    });
    expect(await barRows(widget, fakeWidgetContext())).toEqual([
      { key: "kwork", label: "Kwork", value: 3 },
      { key: OTHER_KEY, label: "Other", value: 2 },
    ]);
  });
});
