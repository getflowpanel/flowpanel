import { resolveFormatting } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { kvDisplay } from "../runtime/kv-display";

const utc = resolveFormatting();

describe("kvDisplay", () => {
  it("shows a Date as a day for format: date", () => {
    expect(kvDisplay(new Date("2026-09-23T21:30:00Z"), "date", utc)).toBe("2026-09-23");
  });

  it("keeps the full timestamp for a Date with no format", () => {
    expect(kvDisplay(new Date("2026-09-23T21:30:00Z"), undefined, utc)).toBe("2026-09-23 21:30");
  });

  it("renders a duration, a percent and a boolean the way a table cell does", () => {
    expect(kvDisplay(7_500_000, "duration", utc)).toBe("2 hr 5 min");
    expect(kvDisplay(0.423, { kind: "percent" }, utc)).toBe("42.3%");
    expect(kvDisplay(true, "boolean", utc)).toBe("✓");
  });

  it("reads a numeric string the way a table cell does, as Postgres returns numeric", () => {
    expect(kvDisplay("0.423", "percent", utc)).toBe("42.3%");
    expect(kvDisplay("7500000", "duration", utc)).toBe("2 hr 5 min");
  });
});
