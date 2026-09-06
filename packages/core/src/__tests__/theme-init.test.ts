import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { buildThemeInitScript } from "../index";

function apply(
  stored: string | null,
  mode: "auto" | "dark" | "light",
  prefersDark: boolean,
  storageBlocked = false,
) {
  const dataset: Record<string, string> = {};
  const hostClass = "host-dark-mode";
  const root = { dataset, className: hostClass };
  runInNewContext(buildThemeInitScript(mode), {
    document: { documentElement: root },
    localStorage: {
      getItem: () => {
        if (storageBlocked) throw new Error("storage blocked");
        return stored;
      },
    },
    window: { matchMedia: () => ({ matches: prefersDark }) },
  });
  expect(root.className).toBe(hostClass);
  return dataset.flowpanelTheme;
}

describe("server-safe theme initialization", () => {
  it("is callable from the core server entry without browser globals", () => {
    expect(typeof buildThemeInitScript()).toBe("string");
  });
  it("respects stored preference, explicit default, and system preference", () => {
    expect(apply("light", "dark", true)).toBe("light");
    expect(apply("dark", "light", false)).toBe("dark");
    expect(apply(null, "dark", false)).toBe("dark");
    expect(apply(null, "auto", true)).toBe("dark");
    expect(apply("invalid", "auto", false)).toBe("light");
  });
  it("applies the configured fallback even when browser storage is blocked", () => {
    expect(apply(null, "dark", false, true)).toBe("dark");
    expect(apply(null, "auto", true, true)).toBe("dark");
  });
  it("does not embed arbitrary runtime configuration into an HTML script", () => {
    const script = buildThemeInitScript("</script><script>alert(1)</script>" as "auto");
    expect(script).not.toContain("</script>");
    expect(script).not.toContain("alert(1)");
  });
});
