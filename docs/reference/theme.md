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
