# @flowpanel/next

Next.js 15 App Router integration for FlowPanel.

[![npm](https://img.shields.io/npm/v/@flowpanel/next.svg)](https://www.npmjs.com/package/@flowpanel/next)

> Most users import from **`flowpanel/next`** (umbrella subpath).

## Mount

Two route files own the entire admin surface:

```ts
// app/admin/[[...slug]]/page.tsx
import { Flowpanel } from "flowpanel/next";
import config from "@/flowpanel.config";

export default Flowpanel(config);
```

```ts
// app/api/flowpanel/[...route]/route.ts
import { handlers } from "flowpanel/next";
import config from "@/flowpanel.config";

export const { GET, POST } = handlers(config);
export const runtime = "nodejs";
```

```ts
// app/api/flowpanel/stream/route.ts
import { stream } from "flowpanel/next";
import config from "@/flowpanel.config";

export const GET = stream(config);
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
```

`flowpanel init` writes all three.

## What's wired

- RSC catch-all dispatching dashboards, resource list/detail/edit/create, queue iframe pages.
- Server Actions for create / update / delete with `revalidatePath` + `publishResource`.
- SSE stream with 15s heartbeat + abort handling.
- Drawer GET (`/api/flowpanel/drawer/<r>/<id>`) and drawer-action POST (`/api/flowpanel/drawer/<r>/<id>/actions/<key>`) — both dispatched by `handlers()`.
- Auth + scope + rate-limit checks per request, audit emission on mutations.

## Documentation

<https://flowpanel.dev>

## License

MIT
