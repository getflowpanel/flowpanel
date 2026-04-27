import { describe, expect, it } from "vitest";
import { resolvePresetStyle, THEME_PRESETS, tokensToStyle } from "../presets";

describe("theme presets", () => {
  it("exposes default / violet / emerald / slate", () => {
    expect(Object.keys(THEME_PRESETS).sort()).toEqual(
      ["default", "emerald", "slate", "violet"].sort(),
    );
  });

  it("tokensToStyle maps known keys to --fp-* variables", () => {
    const style = tokensToStyle({ primary: "221 83% 53%", radius: "0.5rem" });
    expect(style["--fp-primary"]).toBe("221 83% 53%");
    expect(style["--fp-radius"]).toBe("0.5rem");
  });

  it("skips empty or nullish values", () => {
    const style = tokensToStyle({ primary: "", success: undefined });
    expect(Object.keys(style)).toHaveLength(0);
  });

  it("user overrides beat the preset", () => {
    const style = resolvePresetStyle("violet", { primary: "340 100% 50%" });
    expect(style["--fp-primary"]).toBe("340 100% 50%");
  });

  it("preset alone emits its tokens", () => {
    const style = resolvePresetStyle("emerald", undefined);
    expect(style["--fp-primary"]).toBe("160 84% 39%");
  });
});
