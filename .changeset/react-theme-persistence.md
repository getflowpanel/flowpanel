---
"@flowpanel/react": patch
"@flowpanel/next": patch
---

Dark-mode toggle now persists across navigation. The ⌘K palette "Toggle dark mode" command writes to `localStorage["fp-theme"]` and reapplies the class via a SSR-safe inline `<ThemeScript>` injected by `<FlowpanelGlobals>` before first paint (no FOUC). `useTheme()` hook + `toggleTheme()` / `readStoredTheme()` / `applyThemeClass()` runtime exposed publicly. If `theme.mode = "auto"` is set in config, `prefers-color-scheme` seeds the default; an explicit user choice from the toggle overrides. Host apps must add `suppressHydrationWarning` to their `<html>` tag (standard pattern, same as next-themes).
