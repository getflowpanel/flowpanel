import { describe, expect, it } from "vitest";
import { DEFAULT_FORMATTING, resolveFormatting } from "../types/formatting";

describe("resolveFormatting", () => {
  it("marks a configured time zone as coming from the config", () => {
    const resolved = resolveFormatting({ timeZone: "Europe/Moscow" });
    expect(resolved.timeZone).toBe("Europe/Moscow");
    expect(resolved.timeZoneSource).toBe("config");
  });

  it("marks the UTC fallback as the default", () => {
    expect(resolveFormatting().timeZoneSource).toBe("default");
    expect(resolveFormatting({ locale: "ru-RU" }).timeZoneSource).toBe("default");
    expect(DEFAULT_FORMATTING.timeZoneSource).toBe("default");
  });
});
