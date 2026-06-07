import type { InferRow } from "../types/registry.js";
import type { ResourceConfig, ResourceOptions } from "../types/resource.js";

/** Register one table or model as an admin resource. */
export function resource<Ref>(ref: Ref, options: ResourceOptions<InferRow<Ref>>): ResourceConfig {
  // biome-ignore lint/suspicious/noExplicitAny: deliberate row-type erasure — ResourceConfig.options is ResourceOptions<any> so the heterogeneous registry accepts any concrete row; ResourceOptions<Row> has Row in contravariant positions, so `unknown` is not assignable here.
  return { __kind: "resource", ref, options: options as ResourceOptions<any> };
}
