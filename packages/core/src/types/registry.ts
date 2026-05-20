/**
 * Consumer-augmentable registry for FlowPanel type bindings.
 *
 * Augment in your app's config file to bind your adapter's `db` type
 * into every `WidgetContext` automatically, without per-callsite annotations.
 *
 * For Prisma users (who pass a model *name string* to `resource()`),
 * augment `models` to recover the same `Row` inference Drizzle users get
 * for free via `Table["$inferSelect"]`:
 *
 * @example
 *   import { db } from "@/src/db/client";
 *   import type { User, Post } from "@prisma/client";
 *   declare module "@flowpanel/core" {
 *     interface FlowpanelTypes {
 *       db: typeof db;
 *       models: { User: User; Post: Post };
 *     }
 *   }
 */
export interface FlowpanelTypes {
  // empty — consumers augment
}

/** Resolves to `FlowpanelTypes["db"]` if the user augmented, else `unknown`. */
export type InferDB = FlowpanelTypes extends { db: infer D } ? D : unknown;

/**
 * Infers the row shape for a `resource(ref, ...)` call.
 *
 * - Drizzle: `ref` is a `Table` with `$inferSelect` → that's the row type.
 * - Prisma: `ref` is a model name string; looks up
 *   `FlowpanelTypes["models"][Ref]` if augmented, else falls back to
 *   `Record<string, unknown>`.
 * - Anything else: `Record<string, unknown>` (loose but safe — typos in
 *   `columns: [...]` will still flag against the column union, which is
 *   `string`).
 */
export type InferRow<Ref> = Ref extends { $inferSelect: infer R }
  ? R
  : Ref extends string
    ? FlowpanelTypes extends { models: infer M }
      ? Ref extends keyof M
        ? M[Ref]
        : Record<string, unknown>
      : Record<string, unknown>
    : Record<string, unknown>;
