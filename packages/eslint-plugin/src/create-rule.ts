import { ESLintUtils } from "@typescript-eslint/utils";

/**
 * Factory for creating FlowPanel ESLint rules with a consistent docs URL.
 *
 * Rules built via this helper get a docs URL like
 * `https://flowpanel.dev/docs/eslint-plugin/<rule-name>` (placeholder; the
 * domain may change before 1.0).
 */
export const createRule = ESLintUtils.RuleCreator(
  (name) => `https://flowpanel.dev/docs/eslint-plugin/${name}`,
);
