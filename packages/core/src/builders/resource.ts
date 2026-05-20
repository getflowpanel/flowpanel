import type { InferRow } from "../types/registry.js";
import type { ResourceConfig, ResourceOptions } from "../types/resource.js";

export function resource<Ref>(ref: Ref, options: ResourceOptions<InferRow<Ref>>): ResourceConfig {
  return { __kind: "resource", ref, options: options as ResourceOptions<any> };
}
