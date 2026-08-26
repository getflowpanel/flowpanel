---
"@flowpanel/core": minor
"@flowpanel/next": minor
"@flowpanel/adapter-drizzle": minor
"@flowpanel/adapter-prisma": minor
"@flowpanel/eslint-plugin": minor
---

Remove public API that no runtime surface ever reached, before 0.2 freezes it.

`runMutationPipeline` and its `MutationPipelineStage`, `MutationPipeline` and
`PostCommitEffect` types are gone from `@flowpanel/core`. They were documented
as the one ordered mutation runner shared by generated pages, HTTP handlers and
headless surfaces; nothing called them, and all four real mutation surfaces
order their own stages.

`FieldDef.visibleWhen` and `FieldDef.disabledWhen` are gone, along with the
`UiCondition` AST and `evaluateUiCondition`. No form renderer read them:
`resolve-form-fields` builds each `ResolvedField` explicitly and the client
field spec has no slot for a condition tree.

`ColumnDef.select` is gone. It was validated at compile time and folded into a
projection nothing consulted at runtime. A `render` column that declares no
`field` still fails compilation, with the message adjusted accordingly.

`AdapterCapabilities` keeps only `version`. The `projections`, `transactions`,
`atomicImport`, `returningRows` and `migrations` flags, the redundant
`AdapterV2.transaction` redeclaration, the `adapterCapabilities` v1 bridge and
`assertAdapterCapabilities` are removed — no runtime code branched on a flag,
and the only consumer was a self-consistency check over the flags themselves.
The shipped drizzle and prisma adapters now declare `capabilities: { version: 2 }`.
`Adapter.transaction` is untouched.

`CompiledResource.clientProjection` and `serverProjection`, the
`collectResourceExposure` collector that built them, and `getCompiledAdmin` are
removed from `@flowpanel/core`. The doc comment claiming the projections were
shared by every runtime surface was false — `@flowpanel/next` derives its own
field allowlists.

`projectRow` is removed from `@flowpanel/next`. It was a synchronous twin of
`projectAuthorizedRow` with only test callers, carrying a weaker field-policy
check that would have leaked fields under a request-scoped `read` rule.
`projectAuthorizedRow` and `declaredRowFields` are unchanged.

The `no-server-import-in-client` ESLint rule inspects bare specifiers again.
It had been narrowed to app-local specifiers, so a package's server subpath —
including the one this framework itself publishes — imported from a
`"use client"` file passed silently. `next/server` remains allowed.
