import auditRowActionNeedsConfirm from "./rules/audit-row-action-needs-confirm.js";
import noServerImportInClient from "./rules/no-server-import-in-client.js";
import noTypoColumnKeyword from "./rules/no-typo-column-keyword.js";
import preferShorthandFilter from "./rules/prefer-shorthand-filter.js";
import requireUniqueResourceNames from "./rules/require-unique-resource-names.js";

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
