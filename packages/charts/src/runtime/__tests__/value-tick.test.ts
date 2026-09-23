import { resolveFormatting } from "@flowpanel/core/format";
import { describe, expect, it } from "vitest";
import { buildValueTickFormatter } from "../chart-theme";

describe("value axis ticks", () => {
  it("print a duration in its largest unit, short enough for a 40 px axis", () => {
    const en = buildValueTickFormatter("duration", resolveFormatting());
    const ru = buildValueTickFormatter("duration", resolveFormatting({ locale: "ru-RU" }));
    expect(en?.(7_500_000)).toBe("2.1h");
    expect(ru?.(7_500_000)).toBe("2,1 ч");
    expect((en?.(7_500_000) ?? "").length).toBeLessThanOrEqual(6);
  });
});
