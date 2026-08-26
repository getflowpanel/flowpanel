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
  } catch {}
}

/** Apply a namespaced theme marker without mutating the host app's `.dark` class. */
export function applyThemeClass(choice: ThemeChoice): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.flowpanelTheme = choice;
  for (const root of document.querySelectorAll<HTMLElement>("[data-flowpanel-root]")) {
    root.dataset.theme = choice;
  }
}

/** Toggle dark mode, persist the choice, and apply the namespaced marker. */
export function toggleTheme(): ThemeChoice {
  const currentlyDark =
    typeof document !== "undefined" && document.documentElement.dataset.flowpanelTheme === "dark";
  const next: ThemeChoice = currentlyDark ? "light" : "dark";
  writeStoredTheme(next);
  applyThemeClass(next);
  return next;
}

/** Inline script body that runs before React hydration. */
export function buildThemeInitScript(defaultMode: ThemeMode = "auto"): string {
  return `(function(){try{var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var m=${JSON.stringify(defaultMode)};var sys=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;var d=s==='dark'||s==='light'?s:(m==='dark'||(m==='auto'&&sys)?'dark':'light');document.documentElement.dataset.flowpanelTheme=d;}catch(e){}})();`;
}
