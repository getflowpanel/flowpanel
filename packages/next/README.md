# @flowpanel/next

Next.js 16 App Router integration for FlowPanel.

[![npm](https://img.shields.io/npm/v/@flowpanel/next.svg)](https://www.npmjs.com/package/@flowpanel/next)

> Most users import from **`@flowpanel/kit/next`** (umbrella subpath).

## Mount

Two route files own the entire admin surface:

```ts
// app/admin/[[...slug]]/page.tsx
import { createFlowpanel } from "@flowpanel/kit/next";
import config from "@/flowpanel.config";

const flowpanel = createFlowpanel(config);

export default flowpanel.page;
```

```ts
// app/api/flowpanel/[...route]/route.ts
import { createFlowpanel } from "@flowpanel/kit/next";
import config from "@/flowpanel.config";

const flowpanel = createFlowpanel(config);

export const { GET, POST, PUT, PATCH, DELETE, OPTIONS } = flowpanel.handlers;
export const runtime = "nodejs";
```

```ts
// app/api/flowpanel/stream/route.ts
import { stream } from "@flowpanel/kit/next";
import config from "@/flowpanel.config";

export const GET = stream(config);
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
```

`flowpanel init` writes all three.

Dashboard chart widgets are optional. Granular `@flowpanel/next` installs must
also add `@flowpanel/charts` and `recharts`; `@flowpanel/kit` already includes
the chart package and only needs the `recharts` peer.

## What's wired

- RSC catch-all dispatching dashboards, resource list/detail/edit/create, queue iframe pages.
- Create / update / delete forms POST to the `handlers()` API routes — the single action transport (no Server Actions) — which apply `revalidatePath` + `publishResource` on success.
- SSE stream with 15s heartbeat + abort handling.
- Drawer GET (`/api/flowpanel/drawer/<r>/<id>`) and drawer-action POST (`/api/flowpanel/drawer/<r>/<id>/actions/<key>`) — both dispatched by `handlers()`.
- Auth + scope + rate-limit checks per request, audit emission on mutations.

## Row field declarations

List queries and rows use only `columns`, `rowKey`, and `resource.expose` after
field-read policy. Put dependencies used solely by a detail header, hidden tab,
related-tab filter, or custom detail renderer in `detail.expose`; those fields
are read only on the detail page and never widen the list payload. Detail tab
`fields` are selected only for the active visible tab. Callbacks receive these
declared readable fields, so do not rely on incidental columns from an adapter
row.

## Edit-form dependencies

`update.expose` declares extra row properties used only by edit-form `hidden`
and `readOnly` predicates. It is typed to the resource row and validated against
adapter columns. FlowPanel resolves field-read policy before the scoped edit
read, selects only readable known columns, and projects the returned row again
before resolving controls. An exposed property never adds a control, default
value, or write permission. A read-denied or sensitive form field remains blank
(and may still accept an authorized replacement); a denied reference value does
not trigger its related label lookup.

## Documentation

<https://flowpanel.tech>

## License

MIT
