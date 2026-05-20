# Theme

FlowPanel ships a small theme surface with three layers, ordered from
highest leverage to lowest:

1. **Component overrides** — swap one of the 10 slot primitives for your
   own React component (`theme.components`).
2. **CSS variables at runtime** — set `--fp-*` tokens via `theme.cssVars`
   without rebuilding.
3. **Stylesheet override** — load your own CSS that targets the same
   `--fp-*` tokens.

> **WIP — preset bundle (`THEME_PRESETS`, `resolvePresetStyle`,
> `themeToClassName`, `<FlowPanelUI>` wrapper) is not implemented.**
> Today the API is `theme.components`, `theme.cssVars`, and the brand /
> nav / user fields below.

## `ThemeConfig`

`packages/core/src/types/config.ts:26`:

```ts
interface ThemeConfig {
  brand?:  { name?: string; logo?: string; href?: string };
  accent?: string;
  mode?:   "light" | "dark" | "auto";
  cssVars?: Record<string, string>;
  components?: Record<string, ComponentType<any>>;
  nav?:  { groups?: Array<{ label: string; items: string[] }> };
  user?: (s: Session | null) => {
    name?: string; email?: string; avatar?: string;
    items?: Array<{ label: string; href?: string; variant?: "default" | "destructive" }>;
    signOut?: string;
  };
}
```

```ts
defineAdmin({
  ...,
  theme: {
    brand: { name: "Acme Admin", logo: "/logo.svg", href: "/" },
    cssVars: { "--fp-accent": "266 90% 60%", "--fp-radius": "0.375rem" },
    components: { MetricCard: MyMetricCard },
    nav: { groups: [{ label: "Ops", items: ["users", "jobs"] }] },
  },
});
```

The `accent` and `mode` fields are part of the type but their effect
depends on whether your CSS layer reads them. The shipped stylesheet
toggles dark via the `.dark` class (`packages/react/src/styles/admin.css:40`).

## Component overrides — the 10 slots

The slots are defined in
`packages/react/src/_provider/ComponentsContext.tsx:28`:

| Slot | Default props type |
|---|---|
| `EmptyState` | `EmptyStateProps` |
| `MetricCard` | `MetricCardProps` |
| `Button` | `ButtonProps` |
| `Badge` | `BadgeProps` |
| `Avatar` | `AvatarProps` |
| `StatusBadge` | `StatusBadgeProps` |
| `PageHeader` | `PageHeaderProps` |
| `Pagination` | `PaginationProps` |
| `ConfirmDialog` | `ConfirmDialogProps` |
| `SkeletonTable` | `SkeletonTableProps` |

Pass overrides through `theme.components` in `defineAdmin`. The
`@flowpanel/next` shell wires them into the React tree via
`ComponentsProvider` automatically.

For ad-hoc React trees outside the FlowPanel shell, use the provider
directly:

```tsx
import { ComponentsProvider } from "@flowpanel/react";
import { MyButton } from "./MyButton";

<ComponentsProvider value={{ Button: MyButton }}>
  {children}
</ComponentsProvider>
```

(`packages/react/src/_provider/ComponentsContext.tsx:58`).

The `Button` override should be `forwardRef`-aware to stay compatible
with Radix `asChild`.

## CSS tokens

The actual tokens live in `packages/react/src/styles/admin.css:1`. Color
values are HSL triplets (no `hsl()` wrapper) so `hsl(var(--token) /
<alpha>)` works downstream.

| Group | Variables |
|---|---|
| Background | `--fp-bg-1`, `--fp-bg-2`, `--fp-bg-3` |
| Text | `--fp-text-1`, `--fp-text-2`, `--fp-text-3` |
| Border | `--fp-border-1`, `--fp-border-2` |
| Accent | `--fp-accent`, `--fp-accent-text` |
| Semantic | `--fp-ok`, `--fp-warn`, `--fp-err` |
| Radius | `--fp-radius-sm`, `--fp-radius`, `--fp-radius-lg` |
| Spacing | `--fp-space-unit` (4px base) |
| Type | `--fp-font-sans`, `--fp-font-mono` |
| Motion duration | `--fp-duration-fast` (120ms), `--fp-duration` (180ms), `--fp-duration-slow` (280ms) |
| Motion easing | `--fp-ease-out`, `--fp-ease-in-out`, `--fp-ease-spring` |

Dark-mode overrides live under the `.dark` class
(`packages/react/src/styles/admin.css:40`).

`prefers-reduced-motion: reduce` zeros all motion durations
(`packages/react/src/styles/admin.css:51`).

The `@theme` block at the bottom of `admin.css` exposes the same tokens
as Tailwind v4 utilities (`bg-fp-bg-1`, `text-fp-text-2`,
`rounded-fp`, etc.).

## Runtime token overrides

Either feed `theme.cssVars` (the runtime applies them as inline `style`
on the shell root):

```ts
theme: { cssVars: { "--fp-accent": "266 90% 60%", "--fp-radius": "0.375rem" } }
```

Or scope your own stylesheet:

```css
.fp-admin {
  --fp-accent: 266 90% 60%;
  --fp-radius: 0.375rem;
}
```

Both approaches cascade to every primitive that reads the token.

## Dark mode persistence

FlowPanel persists the user's light/dark choice in
`localStorage["fp-theme"]` and applies the `.dark` class on
`<html>` before hydration to avoid a flash of light/dark mismatch.

### `<ThemeScript />`

Inline `<script>` that runs synchronously on first paint to apply the
stored class. Rendered automatically by `<FlowpanelGlobals>` (which
`Flowpanel()` mounts for you), so for the standard wiring there is
nothing manual to do. Source: `packages/react/src/_shell/ThemeScript.tsx:9`.

```tsx
import { ThemeScript } from "@flowpanel/react";

// Render inside <head> if you mount the admin without <FlowpanelGlobals>.
<ThemeScript defaultMode="auto" />
```

The `defaultMode` prop sets which mode wins when the user has no stored
choice: `"light"`, `"dark"`, or `"auto"` (follow `prefers-color-scheme`).
Defaults to `"auto"`. `<FlowpanelGlobals>` forwards
`theme.mode` from `defineAdmin({ theme })` automatically.

### `<html suppressHydrationWarning>` is required

Because `ThemeScript` mutates `<html class>` before React hydrates, React
will see a className mismatch on first render and warn unless the host
app's root layout opts out:

```tsx
// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
```

Same pattern as `next-themes`. The flag scopes warning suppression to the
single attribute, not the whole tree.

### `useTheme()` hook

```ts
import { useTheme } from "@flowpanel/react";

function ThemeToggle() {
  const { theme, toggle, setTheme } = useTheme();
  return (
    <button onClick={toggle}>
      {theme === "dark" ? "Light" : "Dark"} mode
    </button>
  );
}
```

`UseTheme` (`packages/react/src/hooks/useTheme.ts:21`):

| Field | Type |
|---|---|
| `theme` | `"light" \| "dark"` — current resolved choice |
| `toggle` | `() => void` — flip & persist |
| `setTheme` | `(next: "light" \| "dark") => void` — set explicitly & persist |

Options: `{ defaultMode?: "light" \| "dark" \| "auto" }`. When `"auto"`
and no stored choice, the hook watches `prefers-color-scheme` and updates
live.

### Runtime helpers (no hook)

`@flowpanel/react` also re-exports the imperative API the hook is built
on, useful from event handlers outside React (`packages/react/src/lib/theme.ts`):

```ts
import {
  applyThemeClass,
  buildThemeInitScript,
  readStoredTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
  toggleTheme,
  writeStoredTheme,
} from "@flowpanel/react";

toggleTheme();                  // flip + persist, returns "light" | "dark"
applyThemeClass("dark");        // just sets html.classList, no persistence
writeStoredTheme("dark");       // just persists
readStoredTheme();              // string | null
```

The built-in `Toggle dark mode` command in the ⌘K palette calls
`toggleTheme()` directly.
