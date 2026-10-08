import type { Adapter, ResourceIntrospection } from "../types/adapter";

/** What the adapter could tell about a ref: its introspection, or the error that kept it from answering. */
export type Introspected =
  | { introspection: ResourceIntrospection; error?: undefined }
  | { introspection: null; error: unknown };

/** Introspect without failing the boot: a ref the adapter cannot read is handled by the caller. */
export function tryIntrospect(adapter: Adapter, ref: unknown): Introspected {
  try {
    return { introspection: adapter.introspect(ref) };
  } catch (error) {
    return { introspection: null, error };
  }
}
