import type { UiCondition } from "../types/policy.js";

function sameJsonValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) {
    return false;
  }
  return JSON.stringify(left) === JSON.stringify(right);
}

/** Evaluate the serializable UI-only condition AST. It never grants server access. */
export function evaluateUiCondition<Row>(
  condition: UiCondition<Row>,
  values: Partial<Row>,
): boolean {
  if ("all" in condition) return condition.all.every((item) => evaluateUiCondition(item, values));
  if ("any" in condition) return condition.any.some((item) => evaluateUiCondition(item, values));
  if ("not" in condition) return !evaluateUiCondition(condition.not, values);
  if ("eq" in condition) return sameJsonValue(values[condition.field], condition.eq);
  if ("neq" in condition) return !sameJsonValue(values[condition.field], condition.neq);
  return condition.in.some((candidate) => sameJsonValue(values[condition.field], candidate));
}
