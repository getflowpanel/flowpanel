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
