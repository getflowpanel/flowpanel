import { describe, expect, it } from "vitest";
import { readThemeSlots } from "./theme-slots";

describe("readThemeSlots", () => {
  it("reads the merged React slot registry from source", () => {
    const slots = readThemeSlots();

    expect(slots).toHaveLength(10);
    expect(slots.map((slot) => slot.name)).toEqual(
      expect.arrayContaining(["Button", "MetricCard", "ConfirmDialog", "SkeletonTable"]),
    );
    expect(slots.find((slot) => slot.name === "Button")?.type).toContain("ButtonProps");
  });
});
