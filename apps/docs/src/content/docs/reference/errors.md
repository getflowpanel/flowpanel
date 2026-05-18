---
title: 'Error UX'
description: 'FlowPanel throws `FlowPanelConfigError` at startup for any misconfiguration'
---


FlowPanel throws `FlowPanelConfigError` at startup for any misconfiguration
that can be detected statically. The rendered message includes:

- Location (file:line:col) of the offending value.
- Code frame showing ±2 lines around it.
- A one-line hint where we have one.
- "Did you mean?" candidates for typos.
- A docs URL for deeper context.

```
FlowPanel config error: Invalid enum value. Expected "pro" | "team" | "free", received "prou" at security.permissions.role

  at src/flowpanel.ts:42:15

  40 │     auth: { getSession },
  41 │     permissions: {
> 42 │       prou: { read: ["*"], write: ["*"] },
     │               ^
  43 │     },
  44 │   },

  Did you mean: "pro"?
  Docs: https://flowpanel.dev/docs/reference/config
```

## Public API

```ts
import {
  FlowPanelConfigError,
  didYouMean,
  fromZodError,
  renderCodeFrame,
  renderConfigError,
} from "@flowpanel/core";
```

- `FlowPanelConfigError(message, context?)` — raise your own config errors
  with the same formatting. `context` accepts `{ source, hint, didYouMean,
  docs, received }`.
- `didYouMean(input, candidates)` — typo helper powering the suggestions.
- `fromZodError(err, { received?, docs? })` — wrap a `ZodError` so the
  rendered output matches the rest of FlowPanel's error surface.
- `renderConfigError(message, context)` — assemble the multi-line string
  yourself (useful in custom tooling).
- `renderCodeFrame(filePath, { line, column, context })` — the code-frame
  reader without any error scaffolding. Returns `null` if the file can't
  be read.

## Writing your own config errors

```ts
import { FlowPanelConfigError } from "@flowpanel/core";

throw new FlowPanelConfigError('Resource "payment" references unknown column "amnt"', {
  hint: "Check the columns block of your payment resource",
  didYouMean: ["amount"],
  docs: "https://flowpanel.dev/docs/reference/resources#columns",
});
```

`err.rawMessage` preserves the unformatted text if you need to re-render or
forward it elsewhere; `err.context` exposes the structured fields.
