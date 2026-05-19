import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyThemeClass,
  buildThemeInitScript,
  readStoredTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
  toggleTheme,
  writeStoredTheme,
} from "../theme.js";

describe("theme runtime", () => {
  beforeEach(() => {
    document.documentElement.classList.remove("dark");
    localStorage.clear();
  });

  afterEach(() => {
    document.documentElement.classList.remove("dark");
    localStorage.clear();
  });

  describe("resolveTheme", () => {
    it("returns the stored value when it is 'light' or 'dark'", () => {
      expect(resolveTheme("dark", "light", false)).toBe("dark");
      expect(resolveTheme("light", "dark", true)).toBe("light");
    });

    it("falls back to defaultMode when stored is null and default is explicit", () => {
      expect(resolveTheme(null, "dark", false)).toBe("dark");
      expect(resolveTheme(null, "light", true)).toBe("light");
    });

    it("respects prefers-color-scheme under auto", () => {
      expect(resolveTheme(null, "auto", true)).toBe("dark");
      expect(resolveTheme(null, "auto", false)).toBe("light");
    });

    it("ignores garbage stored values", () => {
      expect(resolveTheme("haunted", "light", true)).toBe("light");
    });
  });

  describe("read/writeStoredTheme", () => {
    it("round-trips light/dark through localStorage", () => {
      writeStoredTheme("dark");
      expect(readStoredTheme()).toBe("dark");
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
      writeStoredTheme("light");
      expect(readStoredTheme()).toBe("light");
    });
  });

  describe("applyThemeClass", () => {
    it("adds/removes the dark class on <html>", () => {
      applyThemeClass("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      applyThemeClass("light");
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
  });

  describe("toggleTheme", () => {
    it("flips the class and persists the choice", () => {
      const first = toggleTheme();
      expect(first).toBe("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");

      const second = toggleTheme();
      expect(second).toBe("light");
      expect(document.documentElement.classList.contains("dark")).toBe(false);
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    });
  });

  describe("buildThemeInitScript", () => {
    it("references the storage key so the inline script reads the same slot", () => {
      const script = buildThemeInitScript("auto");
      expect(script).toContain(JSON.stringify(THEME_STORAGE_KEY));
      expect(script).toContain("auto");
    });

    it("embeds the default mode literally", () => {
      expect(buildThemeInitScript("dark")).toContain('"dark"');
      expect(buildThemeInitScript("light")).toContain('"light"');
    });
  });
});
