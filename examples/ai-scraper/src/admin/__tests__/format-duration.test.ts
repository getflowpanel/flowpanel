import { describe, expect, it } from "vitest";
import { formatDuration } from "../format";

describe("formatDuration", () => {
  it("picks the unit a person would say", () => {
    expect(formatDuration(820)).toBe("820 ms");
    expect(formatDuration(1_400)).toBe("1.4 s");
    expect(formatDuration(28 * 60_000)).toBe("28 min");
    expect(formatDuration(60 * 60_000)).toBe("1 h");
    expect(formatDuration(65 * 60_000)).toBe("1 h 5 min");
  });

  it("shows a dash for a run that has not finished", () => {
    expect(formatDuration(null)).toBe("—");
  });
});
