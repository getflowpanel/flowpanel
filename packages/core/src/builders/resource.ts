import type { InferRow } from "../types/registry.js";
import type { ResourceConfig, ResourceOptions } from "../types/resource.js";

/**
 * Register one table or model as an admin resource. The first argument is the
 * Drizzle table (or, for Prisma, the model name as a string); the row type is
 * inferred from `ref.$inferSelect` for Drizzle, or from
 * `FlowpanelTypes.models[name]` for Prisma. `options.columns` is type-checked
 * against the row's keys — typos error at the call site with a "Did you mean"
 * suggestion.
 *
 * @example
 * ```ts
 * resource(schema.users, {
 *   label: "Users",
 *   columns: ["email", "role", "createdAt"],
 *   search: ["email"],
 *   defaultSort: { field: "createdAt", dir: "desc" },
 * })
 * ```
 *
 * @example Prisma
 * ```ts
 * resource("User", {
 *   columns: ["email", "role", "createdAt"],
 * })
 * ```
 */
export function resource<Ref>(ref: Ref, options: ResourceOptions<InferRow<Ref>>): ResourceConfig {
  return { __kind: "resource", ref, options: options as ResourceOptions<any> };
}
