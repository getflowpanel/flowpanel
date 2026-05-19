/**
 * FlowPanel theme runtime — dark/light mode persistence.
 *
 * The `dark` class is applied to `<html>` and `admin.css` swaps the design
 * tokens under that selector. User choice (from the ⌘K toggle or any custom
 * UI) is persisted in `localStorage["fp-theme"]`. When `mode: "auto"` is the
 * configured default, `prefers-color-scheme` decides the initial render but
 * an explicit user choice always overrides.
 *
 * To avoid FOUC under SSR, `ThemeScript` (rendered by `<FlowpanelGlobals>`)
 * injects a tiny inline script that runs `applyTheme()` synchronously before
 * React hydrates.
 */

export type ThemeMode = "light" | "dark" | "auto";
export type ThemeChoice = "light" | "dark";

/** localStorage key. Keep stable — referenced by both runtime and head script. */
export const THEME_STORAGE_KEY = "fp-theme";

/** Resolve the effective light/dark choice given a stored value + system pref. */
export function resolveTheme(
  stored: string | null,
  defaultMode: ThemeMode = "auto",
  systemPrefersDark = false,
): ThemeChoice {
  if (stored === "light" || stored === "dark") return stored;
  if (defaultMode === "light" || defaultMode === "dark") return defaultMode;
  return systemPrefersDark ? "dark" : "light";
}

/** Read the stored theme without throwing if localStorage is unavailable. */
export function readStoredTheme(): string | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage.getItem(THEME_STORAGE_KEY) : null;
  } catch {
    return null;
  }
}

/** Write the chosen theme to localStorage, ignoring storage errors. */
export function writeStoredTheme(value: ThemeChoice): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(THEME_STORAGE_KEY, value);
    }
  } catch {
    // ignore — quota/private-mode/SSR
  }
}

/** Toggle html.classList based on resolved theme. */
export function applyThemeClass(choice: ThemeChoice): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (choice === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

/**
 * Toggle dark mode, persist the choice, and apply the class. Returns the new
 * choice so callers can update local state if needed.
 */
export function toggleTheme(): ThemeChoice {
  const currentlyDark =
    typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const next: ThemeChoice = currentlyDark ? "light" : "dark";
  writeStoredTheme(next);
  applyThemeClass(next);
  return next;
}

/**
 * Inline script body that runs before React hydration. Reads storage + system
 * preference and applies the `dark` class so the first paint matches.
 */
export function buildThemeInitScript(defaultMode: ThemeMode = "auto"): string {
  // Keep this string self-contained — it runs without bundler / module scope.
  return `(function(){try{var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var m=${JSON.stringify(defaultMode)};var sys=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;var d=s==='dark'||s==='light'?s==='dark':(m==='dark'||(m==='auto'&&sys));var r=document.documentElement;if(d)r.classList.add('dark');else r.classList.remove('dark');}catch(e){}})();`;
}
