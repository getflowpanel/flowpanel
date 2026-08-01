import type { TSESLint } from "@typescript-eslint/utils";
import auditRowActionNeedsConfirm from "./rules/audit-row-action-needs-confirm.js";
import noServerImportInClient from "./rules/no-server-import-in-client.js";
import noTypoColumnKeyword from "./rules/no-typo-column-keyword.js";
import preferShorthandFilter from "./rules/prefer-shorthand-filter.js";
import requireUniqueResourceNames from "./rules/require-unique-resource-names.js";

/** Kept in step with package.json by `index.test.ts`. */
const VERSION = "0.1.0";

const rules = {
  "prefer-shorthand-filter": preferShorthandFilter,
  "audit-row-action-needs-confirm": auditRowActionNeedsConfirm,
  "no-server-import-in-client": noServerImportInClient,
  "require-unique-resource-names": requireUniqueResourceNames,
  "no-typo-column-keyword": noTypoColumnKeyword,
};

const RECOMMENDED_RULES: Readonly<Record<string, TSESLint.SharedConfig.RuleEntry>> = {
  "flowpanel/prefer-shorthand-filter": "warn",
  "flowpanel/audit-row-action-needs-confirm": "error",
  "flowpanel/no-server-import-in-client": "error",
  "flowpanel/require-unique-resource-names": "error",
  "flowpanel/no-typo-column-keyword": "warn",
};

const plugin = {
  meta: {
    name: "@flowpanel/eslint-plugin",
    version: VERSION,
  },
  rules,
  configs: {} as {
    recommended: TSESLint.FlatConfig.Config;
  },
};

plugin.configs.recommended = {
  name: "flowpanel/recommended",
  plugins: { flowpanel: plugin },
  rules: RECOMMENDED_RULES,
};

export default plugin;
export const { configs } = plugin;
export { rules };
