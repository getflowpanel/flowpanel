---
"@flowpanel/react": minor
---

**B7 — Theme tokens + presets.**

- `ThemeTokens` interface covers the full CSS variable surface
  (`primary`, `radius`, `density`, `fontSans`, etc.).
- Four built-in presets: `default`, `violet`, `emerald`, `slate`.
- `resolvePresetStyle(preset, overrides)` merges preset + user overrides
  into a style map for `<FlowPanelUI style={…}>`.
- `ComponentOverridesProvider` + `useComponentOverride` let users swap the
  built-in `Button`/`Badge`/`Card` primitives without forking FlowPanel.
