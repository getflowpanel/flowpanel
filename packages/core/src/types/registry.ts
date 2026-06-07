/** Consumer-augmentable registry for FlowPanel type bindings. */
// biome-ignore lint/suspicious/noEmptyInterface: must stay an interface — consumers augment it via `declare module` merging to wire db/models (I-12); a `type` alias cannot be merged into.
export interface FlowpanelTypes {}

/** Resolves to `FlowpanelTypes["db"]` if the user augmented, else `unknown`. */
export type InferDB = FlowpanelTypes extends { db: infer D } ? D : unknown;

/** Infers the row shape for a `resource(ref, ...)` call. */
export type InferRow<Ref> = Ref extends { $inferSelect: infer R }
  ? R
  : Ref extends string
    ? FlowpanelTypes extends { models: infer M }
      ? Ref extends keyof M
        ? M[Ref]
        : Record<string, unknown>
      : Record<string, unknown>
    : Record<string, unknown>;

/** Consumer-augmentable map of resource name → row type. */
// biome-ignore lint/suspicious/noEmptyInterface: consumers augment it via `declare module` merging to type cross-resource references; a `type` alias cannot be merged into.
export interface FlowpanelResources {}

export type ResourceName = [keyof FlowpanelResources] extends [never]
  ? string
  : keyof FlowpanelResources & string;

/** A foreign-key reference. */
export type ReferenceSpec = [keyof FlowpanelResources] extends [never]
  ? { resource: string; labelField: string }
  : {
      [R in keyof FlowpanelResources]: {
        resource: R;
        labelField: keyof FlowpanelResources[R] & string;
      };
    }[keyof FlowpanelResources];
