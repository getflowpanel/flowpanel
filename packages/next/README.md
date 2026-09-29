# @flowpanel/next

The Next.js App Router integration for FlowPanel: the admin page, the API route handlers and the realtime stream. Apps use it as `@flowpanel/kit/next`, and `flowpanel init` writes the route files.

## Install

```bash
pnpm add @flowpanel/kit
```

## Example

```ts
// app/admin/[[...slug]]/page.tsx
import { createFlowpanel } from "@flowpanel/kit/next";
import config from "@/flowpanel.config";

const flowpanel = createFlowpanel(config);

export const generateMetadata = flowpanel.metadata;
export default flowpanel.page;
```

[Next.js runtime reference](https://flowpanel.tech/docs/reference/next-runtime) · MIT
