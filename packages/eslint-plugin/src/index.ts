import auditRowActionNeedsConfirm from "./rules/audit-row-action-needs-confirm.js";
import noServerImportInClient from "./rules/no-server-import-in-client.js";
import noTypoColumnKeyword from "./rules/no-typo-column-keyword.js";
import preferShorthandFilter from "./rules/prefer-shorthand-filter.js";
import requireUniqueResourceNames from "./rules/require-unique-resource-names.js";

/**
 * `@flowpanel/eslint-plugin` — catches the common config mistakes FlowPanel
 * users hit when authoring `defineAdmin()` configs.
 *
 * Designed for ESLint v9 flat-config:
 *
 * ```ts
 * import flowpanel from "@flowpanel/eslint-plugin";
 *
 * export default [
 *   {
 *     plugins: { flowpanel },
 *     rules: {
 *       "flowpanel/prefer-shorthand-filter": "warn",
 *       "flowpanel/audit-row-action-needs-confirm": "error",
 *       "flowpanel/no-server-import-in-client": "error",
 *       "flowpanel/require-unique-resource-names": "error",
 *       "flowpanel/no-typo-column-keyword": "warn",
 *     },
 *   },
 * ];
 * ```
 */
const plugin = {
  meta: {
    name: "@flowpanel/eslint-plugin",
    version: "0.0.0",
  },
  rules: {
    "prefer-shorthand-filter": preferShorthandFilter,
    "audit-row-action-needs-confirm": auditRowActionNeedsConfirm,
    "no-server-import-in-client": noServerImportInClient,
    "require-unique-resource-names": requireUniqueResourceNames,
    "no-typo-column-keyword": noTypoColumnKeyword,
  },
} as const;

export default plugin;
export const rules = plugin.rules;
