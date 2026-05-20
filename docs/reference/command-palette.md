# Command palette

A ⌘K palette ships built in. It opens on `Cmd+K` (macOS) or `Ctrl+K`
(Windows/Linux) and starts populated with two built-in groups —
Navigation (every resource + dashboard) and Theme (toggle dark mode).
You can add your own groups via the `commandPalette` config.

```ts
defineAdmin({
  ...,
  commandPalette: {
    placeholder: "Search resources, actions…",
    groups: [
      {
        label: "Actions",
        items: [
          { label: "Open Overview", action: { type: "navigate", href: "/admin" } },
          {
            label: "Reindex search",
            action: { type: "run", fn: async () => fetch("/api/reindex", { method: "POST" }) },
          },
        ],
      },
    ],
  },
});
```

## Keyboard binding

`Cmd+K` / `Ctrl+K` is wired by `useAdminCommand`
(`packages/react/src/hooks/useAdminCommand.ts:25`). It listens on
`window` and stops the default browser binding when the palette opens.

There is no built-in `Esc` rebinding — `cmdk` handles `Escape` to close
the dialog out of the box.

## Built-in groups

The host (`packages/next/src/command/CommandHost.tsx`) registers three
groups in order, each individually disable-able:

| Group | Default | Disable with |
|---|---|---|
| **Navigation** | One entry per resource + dashboard, sourced from `buildNav(config)`. | `disableNavigation: true` |
| Your user groups | `commandPalette.groups` | — |
| **Theme** | `Toggle dark mode` — calls `toggleTheme()` and persists to `localStorage["fp-theme"]`. | `disableTheme: true` |

`disableItems` is reserved for the future cross-resource items search
(Spec §14); it has no effect today because `adapter.searchItems` is not
part of the M2 adapter contract.

## `CommandPaletteConfig`

`packages/core/src/types/command.ts:18`:

```ts
interface CommandPaletteConfig {
  groups?: CommandGroup[];
  placeholder?: string;            // default "Search resources, actions…"
  disableNavigation?: boolean;
  disableItems?: boolean;
  disableTheme?: boolean;
}

interface CommandGroup {
  label: string;
  items: CommandItem[];
}

interface CommandItem {
  label: string;
  icon?: string;
  shortcut?: string;
  keywords?: string[];
  action:
    | { type: "navigate"; href: string }
    | { type: "run"; fn: (ctx: { session: Session | null }) => Promise<unknown> | unknown };
}
```

## Item shapes

### Navigate

```ts
{ label: "Open Overview", action: { type: "navigate", href: "/admin" } }
```

Calls `router.push(href)` and closes the palette.

### Run

```ts
{
  label: "Reindex search",
  shortcut: "⌘⇧R",
  keywords: ["search", "index", "reindex"],
  action: {
    type: "run",
    fn: async ({ session }) => {
      await fetch("/api/reindex", { method: "POST" });
    },
  },
}
```

`fn` runs client-side after the palette closes. The receiver gets
`{ session: null }` today — session is not threaded into client
commands; if you need the live session inside a command, fetch it from
your own session hook.

`shortcut` is **display-only** — it renders as a hint next to the item
but isn't bound to a global keydown.

## Disabling built-ins

```ts
commandPalette: {
  disableTheme: true,
  disableNavigation: false,         // explicit default
}
```

Useful when you replace the theme toggle with your own (e.g. a
three-way light / dark / auto picker rather than a two-way toggle).

## Headless renderer

For an ad-hoc palette outside FlowPanel's shell, render the underlying
`<CommandPalette>` directly:

```tsx
import { CommandPalette, useAdminCommand } from "@flowpanel/react";

function MyPalette({ groups }) {
  const { open, setOpen } = useAdminCommand();
  return <CommandPalette open={open} onOpenChange={setOpen} groups={groups} />;
}
```

`CommandGroupUI` is the UI-layer shape — items take an `onSelect`
callback instead of the typed `action` union.

## See also

- [Shell](./shell.md) — the chrome that hosts the palette
- [Theme](./theme.md) — `toggleTheme()` runtime and `useTheme()` hook
