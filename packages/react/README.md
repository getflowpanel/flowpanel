# @flowpanel/react

The React components FlowPanel renders with: shell, data table, forms, widget cards, atoms and client hooks. Apps use it as `@flowpanel/kit/react` for custom widgets, pages and theme slots.

## Install

```bash
pnpm add @flowpanel/kit
```

## Example

```tsx
import { StatusDot, Sparkline } from "@flowpanel/kit/react";

export function Health({ trend }: { trend: number[] }) {
  return (
    <p>
      <StatusDot tone="ok" /> <Sparkline values={trend} />
    </p>
  );
}
```

[React components reference](https://flowpanel.tech/docs/reference/react-components) · MIT
