# Theme

FlowPanel's UI is styled via CSS variables under the `--fp-*` namespace.
You can pick a preset, override specific tokens, or swap primitives with
your own components.

## Preset

```tsx
import { THEME_PRESETS, resolvePresetStyle } from "@flowpanel/react";

<FlowPanelUI
  style={resolvePresetStyle("violet", undefined)}
  {...rest}
/>
```

Built-in presets: `default`, `violet`, `emerald`, `slate`.

## Custom tokens

```tsx
<FlowPanelUI style={resolvePresetStyle("default", {
  primary: "340 100% 50%",       // HSL channels, space-separated
  radius: "0.375rem",
  density: 0.9,
})} />
```

Every key in `ThemeTokens` maps to a `--fp-*` variable; anything you omit
falls back to the preset, and anything the preset omits falls back to the
base tokens declared in `@flowpanel/react/src/styles/tokens.css`.

## The full token contract

Changing any of these at runtime via CSS (or inline `style`) re-skins the
panel without rebuilds. Everything here is considered a public API —
renames ship as breaking changes.

| Token group | Variables | Purpose |
|---|---|---|
| Color — base | `--fp-background`, `--fp-foreground`, `--fp-muted`, `--fp-muted-foreground`, `--fp-border`, `--fp-input`, `--fp-ring` | Page chrome, inputs, focus |
| Color — brand | `--fp-primary`, `--fp-primary-foreground` | CTAs, active states |
| Color — semantic | `--fp-destructive`, `--fp-destructive-foreground`, `--fp-success`, `--fp-success-foreground` | Warn/ok, status tags |
| Radius | `--fp-radius` (base), `--fp-radius-sm`, `--fp-radius-md`, `--fp-radius-lg` | Corner rounding across cards/inputs/buttons |
| Spacing | `--fp-space-1` … `--fp-space-8` (0.25rem × density … 4rem × density) | Padding, gaps — multiply by `--fp-density` at runtime |
| Density | `--fp-density` | Global scalar for spacing (1 = default, 0.9 = denser, 1.1 = airy) |
| Font size | `--fp-text-xs`, `-sm`, `-base`, `-lg`, `-xl`, `-2xl` | Typographic scale |
| Elevation | `--fp-shadow-xs`, `-sm`, `-md`, `-lg`, `-xl` | Auto-boosted on `.fp-dark` for legibility |
| Motion — duration | `--fp-duration-instant` (80ms), `-fast` (140ms), `-base` (200ms), `-slow` (320ms) | Transition times |
| Motion — easing | `--fp-ease-standard`, `-emphasized`, `-overshoot` | Standard Material-inspired curves |
| Typography | `--fp-font-sans`, `--fp-font-mono` | Font stacks |

### Overriding without React

You can skip `resolvePresetStyle()` entirely and scope CSS directly:

```css
:root {
  --fp-primary: 340 100% 50%;
  --fp-radius: 0.375rem;
  --fp-shadow-md: 0 4px 24px -2px rgb(99 102 241 / 0.4);
}
```

This is the recommended approach when you already have a design system —
FlowPanel inherits whatever you set on `.fp` or its parent.

## Light / dark

```tsx
<FlowPanelUI className={themeToClassName("dark")} ... />
```

The root element gets `.fp-dark` (or `.fp-light`); matching CSS selectors
in `variables.css` swap the palette without changing the layout.

## Component overrides

For brand tweaks beyond colors, you can swap the built-in primitives:

```tsx
import { ComponentOverridesProvider } from "@flowpanel/react";
import { MyButton } from "./MyButton";

<ComponentOverridesProvider value={{ Button: MyButton }}>
  <FlowPanelUI ... />
</ComponentOverridesProvider>
```

Keep the override surface small (Button, Badge, Card). For deeper
customisation, copy a widget into your app via `npx flowpanel add <widget>`
(B9) and edit directly — shadcn-style, no prop-drilling.
