import { AST_NODE_TYPES, type TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../create-rule.js";

type MessageId = "typo";

const TYPOS: Record<string, string> = {
  userid: "userId",
  createdat: "createdAt",
  updatedat: "updatedAt",
  isactive: "isActive",
};

/**
 * Heuristic check for common camelCase typos inside `columns: [...]` entries.
 * The full "did you mean" against the resource's row type needs type info from
 * the parser services and is tracked separately. This rule covers the most
 * frequent lowercase-vs-camelCase mistakes.
 *
 * Autofixable for entries that exactly match a known typo (case-insensitive).
 */
const rule = createRule<[], MessageId>({
  name: "no-typo-column-keyword",
  meta: {
    type: "problem",
    fixable: "code",
    docs: {
      description: "Catch common camelCase typos in `columns: [...]` (e.g. `userid` → `userId`).",
    },
    messages: {
      typo: '"{{actual}}" looks like a typo. Did you mean "{{suggested}}"?',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      Property(node: TSESTree.Property): void {
        if (!isColumnsProperty(node)) return;
        if (node.value.type !== AST_NODE_TYPES.ArrayExpression) return;

        for (const el of node.value.elements) {
          if (!el) continue;
          checkColumnEntry(el);
        }
      },
    };

    function checkColumnEntry(entry: TSESTree.Expression | TSESTree.SpreadElement): void {
      // Bare string entry: `"userid"`.
      if (entry.type === AST_NODE_TYPES.Literal && typeof entry.value === "string") {
        reportIfTypo(entry, entry.value);
        return;
      }
      // Object form: `{ key: "userid", ... }` or `{ name: "userid", ... }`.
      if (entry.type === AST_NODE_TYPES.ObjectExpression) {
        for (const prop of entry.properties) {
          if (prop.type !== AST_NODE_TYPES.Property) continue;
          if (!isKeyOrName(prop)) continue;
          const val = prop.value;
          if (val.type === AST_NODE_TYPES.Literal && typeof val.value === "string") {
            reportIfTypo(val, val.value);
          }
        }
      }
    }

    function reportIfTypo(node: TSESTree.Literal, raw: string): void {
      const suggested = TYPOS[raw.toLowerCase()];
      if (!suggested) return;
      if (raw === suggested) return;
      context.report({
        node,
        messageId: "typo",
        data: { actual: raw, suggested },
        fix(fixer) {
          return fixer.replaceText(node, JSON.stringify(suggested));
        },
      });
    }
  },
});

function isColumnsProperty(node: TSESTree.Property): boolean {
  const key = node.key;
  if (key.type === AST_NODE_TYPES.Identifier) return key.name === "columns";
  if (key.type === AST_NODE_TYPES.Literal) return key.value === "columns";
  return false;
}

function isKeyOrName(prop: TSESTree.Property): boolean {
  const key = prop.key;
  if (key.type === AST_NODE_TYPES.Identifier) {
    return key.name === "key" || key.name === "name";
  }
  if (key.type === AST_NODE_TYPES.Literal) {
    return key.value === "key" || key.value === "name";
  }
  return false;
}

export default rule;
