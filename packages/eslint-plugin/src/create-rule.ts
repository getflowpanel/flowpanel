import { ESLintUtils } from "@typescript-eslint/utils";

/** Factory for creating FlowPanel ESLint rules with a consistent docs URL. */
export const createRule = ESLintUtils.RuleCreator(
  (name) => `https://flowpanel.tech/docs/eslint-plugin/${name}`,
);
