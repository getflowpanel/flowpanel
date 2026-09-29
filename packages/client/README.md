# @flowpanel/client

A typed browser client for FlowPanel's HTTP API, for custom UI that reads and writes resources through the same auth, access and validation as the admin. Apps use it as `@flowpanel/kit/client`.

## Install

```bash
pnpm add @flowpanel/kit
```

## Example

```ts
import { createFlowpanelClient, isFlowpanelErrorResult } from "@flowpanel/kit/client";

const client = createFlowpanelClient(metadata);
const result = await client.resource<{ id: string; email: string }>("users").list({ pageSize: 25 });

if (isFlowpanelErrorResult(result)) console.error(result.error.code);
```

[Typed client reference](https://flowpanel.tech/docs/reference/client) · MIT
