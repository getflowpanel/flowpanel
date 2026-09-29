# @flowpanel/core

FlowPanel's types, builders and runtime: `defineAdmin`, `resource`, `dashboard`, the widget builders, the adapter contract, auth presets, realtime and rate limiting. Apps use it through `@flowpanel/kit`; depend on it directly only to publish an adapter or extension.

## Install

```bash
pnpm add @flowpanel/core
```

## Example

```ts
import type { Adapter } from "@flowpanel/core";

export const myAdapter: Adapter<MyClient, MyTable> = {
  kind: "my-orm",
  db: client,
  introspect,
  inferSchema,
  list,
  get,
  create,
  update,
  delete: remove,
};
```

[Adapter contract](https://flowpanel.tech/docs/reference/adapters) · MIT
