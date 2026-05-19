# Errors

FlowPanel ships a small typed error hierarchy in `@flowpanel/core` for
runtime errors raised from resource handlers, action `run` callbacks,
and the request pipeline. Each error has a stable `code`, an HTTP-style
`status`, and a `safeMessage` intended for the client.

> **WIP — config-time error formatting (`FlowPanelConfigError`,
> `renderConfigError`, `renderCodeFrame`, `didYouMean`,
> `fromZodError`) is not implemented.** Today FlowPanel raises plain
> `Error` (or one of the runtime errors below) on misconfiguration; the
> "code-frame + did-you-mean" surface is planned post-1.0.

## Public exports

`packages/core/src/types/error.ts:1`, re-exported from
`packages/core/src/index.ts:82`:

```ts
import {
  FlowpanelError,
  FlowpanelValidationError,
  FlowpanelAuthError,
  FlowpanelAccessError,
  FlowpanelNotFoundError,
  FlowpanelConflictError,
  FlowpanelRateLimitError,
} from "@flowpanel/core";
```

| Class | `code` | `status` | Notes |
|---|---|---|---|
| `FlowpanelError` | (constructor arg) | `500` | Base class. |
| `FlowpanelValidationError` | `"validation"` | `400` | Carries `fieldErrors: Record<string, string>`. |
| `FlowpanelAuthError` | `"auth"` | `401` | |
| `FlowpanelAccessError` | `"access"` | `403` | Thrown by `assertResourceScope` when a resource is missing scope. |
| `FlowpanelNotFoundError` | `"not_found"` | `404` | |
| `FlowpanelConflictError` | `"conflict"` | `409` | |
| `FlowpanelRateLimitError` | `"rate_limit"` | `429` | Thrown by the rate limiter middleware. |

## Shape

```ts
class FlowpanelError extends Error {
  readonly code: string;
  readonly safeMessage: string;
  readonly status: number;
  toJSON(): { code: string; message: string };
}
```

(`packages/core/src/types/error.ts:1`).

`FlowpanelValidationError` adds:

```ts
readonly fieldErrors: Record<string, string>;
```

(`packages/core/src/types/error.ts:19`).

## Throwing from handlers

```ts
import { FlowpanelValidationError, FlowpanelNotFoundError } from "@flowpanel/core";

run: async (row, _input, ctx) => {
  if (!row.email) throw new FlowpanelValidationError({ email: "Required" });
  const user = await ctx.db.query.users.findFirst({ where: eq(users.id, row.id) });
  if (!user) throw new FlowpanelNotFoundError("User missing");
  ...
}
```

When a handler throws one of the FlowPanel errors, the runtime serializes
`{ code, message }` (and `fieldErrors` for validation errors) into the
HTTP response with the matching `status`. Generic `Error` becomes
`500 Internal Server Error` with a redacted message.

## `onError` hook

```ts
defineAdmin({
  ...,
  hooks: {
    onError: (err, ctx) => reportToSentry(err, { route: ctx.req.url }),
  },
});
```

(`packages/core/src/types/config.ts:94`). Fired for every uncaught error
the runtime intercepts; receives the original error and the active
`RequestContext`.
