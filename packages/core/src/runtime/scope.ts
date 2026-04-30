import { FlowpanelAccessError } from "../types/error.js";

export interface ScopeCheckInput {
  hasGlobal: boolean;
  resourceScope: "bypass" | ((...args: unknown[]) => unknown) | undefined;
}

export function assertResourceScope({ hasGlobal, resourceScope }: ScopeCheckInput): void {
  if (!hasGlobal) return;
  if (resourceScope === "bypass") return;
  if (typeof resourceScope === "function") return;
  throw new FlowpanelAccessError(
    "Resource is missing scope. Global scope is active — every resource must define a scope " +
      'or opt out explicitly with scope: "bypass".',
  );
}
