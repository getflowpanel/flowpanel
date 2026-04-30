import type { ResourceConfig, ResourceOptions } from "../types/resource.js";

export function resource<Row>(ref: unknown, options: ResourceOptions<Row>): ResourceConfig {
  return { __kind: "resource", ref, options: options as ResourceOptions<any> };
}
