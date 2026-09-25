/** Consumer-augmentable registry for FlowPanel type bindings. */
// biome-ignore lint/suspicious/noEmptyInterface: must stay an interface — consumers augment it via `declare module` merging to wire db (I-12); a `type` alias cannot be merged into.
export interface FlowpanelTypes {}

/** Resolves to `FlowpanelTypes["db"]` if the user augmented, else `unknown`. */
export type InferDB = FlowpanelTypes extends { db: infer D } ? D : unknown;

type SchemaOf = FlowpanelTypes extends { schema: infer S } ? S : Record<never, never>;

/** Resource name → row, read from every Drizzle table or view in the registered `schema`. */
export type SchemaResources = {
  [K in keyof SchemaOf as SchemaOf[K] extends {
    _: { name: infer N extends string };
    $inferSelect: object;
  }
    ? N
    : never]: SchemaOf[K] extends { $inferSelect: infer R } ? R : never;
};

/** Consumer-augmentable map of resource name → row type. */
// biome-ignore lint/suspicious/noEmptyInterface: consumers augment it via `declare module` merging to type cross-resource references; a `type` alias cannot be merged into.
export interface FlowpanelResources {}

/**
 * Every row FlowPanel knows by name: the schema's tables and views, and each
 * `FlowpanelResources` entry, which replaces the schema's row under the same name.
 */
export type AllResources = Omit<SchemaResources, keyof FlowpanelResources> & FlowpanelResources;

/** Infers the row shape for a `resource(ref, ...)` call. */
export type InferRow<Ref> = Ref extends { $inferSelect: infer R }
  ? R
  : Ref extends keyof AllResources
    ? AllResources[Ref]
    : Record<string, unknown>;

export type ResourceName = [keyof AllResources] extends [never]
  ? string
  : keyof AllResources & string;

/** A foreign-key reference. */
export type ReferenceSpec = [keyof AllResources] extends [never]
  ? { resource: string; labelField: string }
  : {
      [R in keyof AllResources]: {
        resource: R;
        labelField: keyof AllResources[R] & string;
      };
    }[keyof AllResources];

/** The row of a known resource; any record for a name nothing registers. */
export type RowOf<N extends string> = N extends keyof AllResources
  ? AllResources[N]
  : Record<string, unknown>;
