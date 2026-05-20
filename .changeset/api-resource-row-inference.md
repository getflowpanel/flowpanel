---
"@flowpanel/core": minor
---

`resource(ref, options)` now infers `Row` from `ref`, fixing the framework's main type-safety promise.

Previously `ref: unknown` meant TypeScript could only infer `Row` from `options.columns` itself, so typos like `columns: ["emaiil"]` compiled green. The new signature `resource<Ref>(ref: Ref, options: ResourceOptions<InferRow<Ref>>)` derives the row shape from the ref:

- Drizzle: `ref` is a `Table`; `Row = ref["$inferSelect"]`.
- Prisma: `ref` is a model name string; `Row` resolves through the new optional `FlowpanelTypes["models"]` augmentation. Without augmentation it falls back to `Record<string, unknown>`.
- Anything else: `Record<string, unknown>` (same as before).

`InferRow<Ref>` is now exported. Also fixed: `ResourceOptions.requireRole` typed its function arm as `(s: unknown) => boolean`; it now matches `AuthConfig.requireRole`'s `(s: Session | null) => boolean`.

Minor bump because the tightened types may surface previously silent typos.
