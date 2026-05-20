# Shell

The **shell** is the chrome around your admin content area — the sidebar
with the brand and nav, the embedded tab strip, or no chrome at all.
Configured via the `shell` field on `defineAdmin({ ... })`.

```ts
defineAdmin({
  ...,
  shell: { mode: "sidebar", brand: { name: "Acme Admin" } },
});
```

Three modes ship today (`packages/core/src/types/config.ts:71`):

| Mode | What renders | Use when |
|---|---|---|
| `"sidebar"` *(default)* | Left sidebar with brand + nav groups, content right. Mobile (`<md`): hamburger button opens nav in a Radix dialog drawer. | Standalone admin, FlowPanel owns the whole route. |
| `"tabs"` | Horizontal tab strip across the top, content below. Tabs scroll horizontally on `<md`. | Admin embedded under a host app's existing header. |
| `"bare"` | No chrome at all. Just content. Globals (toasts, drawer host, ⌘K palette, realtime SSE) still mount. | Host app's `app/layout.tsx` (or a wrapper) provides chrome — feature parity is preserved. |

## `ShellConfig` shape

```ts
shell?: ShellConfig | ShellMode;

type ShellMode = "sidebar" | "tabs" | "bare";

interface ShellConfig {
  mode?: ShellMode;                                       // default "sidebar"
  brand?: { name?: string; logo?: string; href?: string } | false;
}
```

(`packages/core/src/types/config.ts:71`, `:73`.)

Shorthand string: `shell: "tabs"` is sugar for `shell: { mode: "tabs" }`.

`brand: false` hides the brand block even in `sidebar` or `tabs` mode.
When `brand` is missing, FlowPanel falls back to `theme.brand`.

## Examples

### Standalone sidebar

```ts
defineAdmin({
  shell: { mode: "sidebar", brand: { name: "Acme Admin", logo: "/logo.svg" } },
  // ...
});
```

### Embedded tabs (host header above)

Lifted from `examples/freelance-radar/flowpanel.config.ts:35`:

```ts
defineAdmin({
  // Embedded mode: the host's app/layout.tsx already provides a top header
  // with the product brand. FlowPanel only contributes the tab strip + the
  // content beneath it.
  shell: { mode: "tabs", brand: false },
  // ...
});
```

### Bare — host owns the chrome

```ts
defineAdmin({
  shell: "bare",
  // ...
});
```

Or via the sugar export:

```ts
// app/admin/[[...slug]]/page.tsx
import { FlowpanelContent } from "@flowpanel/next";
import config from "@/flowpanel.config";

export default FlowpanelContent(config);
```

`FlowpanelContent` is equivalent to `Flowpanel(config, { shell: "bare" })`.

### Per-mount override

```ts
// app/embed/admin/[[...slug]]/page.tsx
import { Flowpanel } from "@flowpanel/next";
import config from "@/flowpanel.config";

export default Flowpanel(config, { shell: "tabs" });
```

`FlowpanelOptions.shell` overrides `defineAdmin({ shell })` at render
time (`packages/next/src/flowpanel-page.tsx:24`). Useful when the same
config is mounted at multiple routes with different chrome.

## Mobile behavior

The sidebar variant ships responsive collapsing out of the box
(`packages/react/src/_shell/AdminShell.tsx:69`):

- `<md` (Tailwind's `md` breakpoint = 768px): the sidebar is hidden and
  a top bar with a hamburger button + brand name is shown. Tapping the
  hamburger opens the nav in a Radix `<Dialog>` drawer occupying
  `min(80vw, 288px)` from the left. The drawer auto-closes when the
  route changes.
- `>=md`: regular inline sidebar.

The tabs variant uses `.fp-scrollbar-hide` (defined in
`packages/react/src/styles/admin.css:154`) so the tab strip scrolls
horizontally on narrow viewports without a system scrollbar showing.

`bare` mode has no shell chrome — your host layout is responsible for
its own responsive behavior.

## What still mounts in `bare`

Even with no chrome, `<FlowpanelGlobals>` still mounts:

- Toast portal
- Drawer host (URL-synced `?drawer=...`)
- ⌘K command palette host
- `<ThemeScript>` (dark-mode init)
- Components provider (`theme.components`)
- Labels provider (i18n)

So `shell: "bare"` is "no visual chrome" — not "no FlowPanel runtime".

## See also

- [Theme](./theme.md) — `theme.brand`, component overrides, dark mode
- [Command palette](./command-palette.md) — built-in groups and config
- [Getting started](../guides/getting-started.md)
