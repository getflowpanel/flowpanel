---
"@flowpanel/core": minor
"@flowpanel/next": minor
"@flowpanel/react": minor
"@flowpanel/kit": minor
"@flowpanel/charts": minor
"@flowpanel/cli": minor
"@flowpanel/client": minor
"@flowpanel/eslint-plugin": minor
"@flowpanel/adapter-drizzle": minor
"@flowpanel/adapter-prisma": minor
"@flowpanel/adapter-bullmq": minor
---

Forms are conform-based and validated end to end, driven by `FieldDef` on the
resource. Charts ship as a runtime. Import/export, field-level RBAC and drawer
actions land on hardened write routes.

Realtime frames every SSE message as `{channel, payload}` and shares one
EventSource per (endpoint, channel). `FlowpanelResources` is the single
row-type registry behind `InferRow`.

The UI gets a 2026 design pass: tokens, chart palette, shell and control
polish, and accessible labelling across every field type.

Breaking: `Tone` replaces the per-surface tone vocabularies, `useAdminMutation`
drops the unwired `optimistic` option, and SSE consumers must read the envelope
instead of the bare payload.
