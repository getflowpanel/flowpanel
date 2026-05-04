/**
 * Consumer-augmentable registry for FlowPanel type bindings.
 *
 * Augment in your app's config file to bind your adapter's `db` type
 * into every `WidgetContext` automatically, without per-callsite annotations.
 *
 * @example
 *   import { db } from "@/src/db/client";
 *   declare module "@flowpanel/core" {
 *     interface FlowpanelTypes { db: typeof db; }
 *   }
 */
export interface FlowpanelTypes {
  // empty — consumers augment
}

/** Resolves to `FlowpanelTypes["db"]` if the user augmented, else `unknown`. */
export type InferDB = FlowpanelTypes extends { db: infer D } ? D : unknown;
