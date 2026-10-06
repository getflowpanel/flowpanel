import type { InferNamedRow, InferRow } from "../types/registry";
import type { ResourceConfig, ResourceOptions } from "../types/resource";

/** Register one table or model as an admin resource. */
export function resource<Ref, const Name extends string>(
  ref: Ref,
  options: ResourceOptions<InferNamedRow<Ref, Name>> & { name: Name },
): ResourceConfig<
  Ref,
  InferNamedRow<Ref, Name>,
  ResourceOptions<InferNamedRow<Ref, Name>> & { name: Name }
>;
export function resource<Ref>(
  ref: Ref,
  options: ResourceOptions<InferRow<Ref>> &
    ([Ref] extends [string] ? { name?: undefined } : unknown),
): ResourceConfig<Ref, InferRow<Ref>, ResourceOptions<InferRow<Ref>>>;
export function resource<Ref>(
  ref: Ref,
  options: ResourceOptions<InferRow<Ref>>,
): ResourceConfig<Ref, InferRow<Ref>, ResourceOptions<InferRow<Ref>>> {
  return { __kind: "resource", ref, options };
}
