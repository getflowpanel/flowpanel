import { describe, expect, it } from "vitest";
import { DEFAULT_FORMATTING, resolveFormatting } from "../types/formatting";

describe("resolveFormatting", () => {
  it("keeps a configured time zone", () => {
    expect(resolveFormatting({ timeZone: "Europe/Moscow" }).timeZone).toBe("Europe/Moscow");
  });

  it("falls back to UTC", () => {
    expect(resolveFormatting().timeZone).toBe("UTC");
    expect(resolveFormatting({ locale: "ru-RU" }).timeZone).toBe("UTC");
    expect(DEFAULT_FORMATTING.timeZone).toBe("UTC");
  });
});
