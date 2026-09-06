import { THEME_STORAGE_KEY, type ThemeMode } from "@flowpanel/core/theme";

export { buildThemeInitScript, THEME_STORAGE_KEY, type ThemeMode } from "@flowpanel/core/theme";
export type ThemeChoice = "light" | "dark";

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

/**
 * The browser's own storage. Node exposes a global `localStorage` of its own, so
 * the bare identifier would make a server render believe storage is available.
 */
function browserStorage(): Storage | null {
  return typeof window === "undefined" ? null : (window.localStorage ?? null);
}

/** Read the stored theme without throwing if localStorage is unavailable. */
export function readStoredTheme(): string | null {
  try {
    return browserStorage()?.getItem(THEME_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

/** Write the chosen theme to localStorage, ignoring storage errors. */
export function writeStoredTheme(value: ThemeChoice): void {
  try {
    browserStorage()?.setItem(THEME_STORAGE_KEY, value);
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
