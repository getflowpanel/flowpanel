---
"@flowpanel/core": minor
"@flowpanel/cli": minor
---

**B3 — Server/Client 3-file convention + audit hook.**

- `createFlowPanelHandler(flowpanel, options?)` packages the tRPC mount into
  a one-liner returning `{ GET, POST, router }`. The Next.js route file
  shrinks from ~30 lines to ~6.
- `flowpanel doctor --boundary-check` detects server-config leaks into
  client bundles. Verifies `import "server-only"` and walks the relative
  import graph for any `"use client"` file reaching the config.
- `config.audit` callback fires a structured `AuditEvent` after every
  mutation — additive to the built-in DB audit log. Failures inside the
  callback are logged and swallowed.
