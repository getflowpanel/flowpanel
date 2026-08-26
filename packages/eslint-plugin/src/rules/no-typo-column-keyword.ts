import { AST_NODE_TYPES, type TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../create-rule";

type MessageId = "typo";

const TYPOS: Record<string, string> = {
  userid: "userId",
  createdat: "createdAt",
  updatedat: "updatedAt",
  isactive: "isActive",
};

/** Heuristic check for common camelCase typos inside `columns: [...]` entries. */
const rule = createRule<[], MessageId>({
  name: "no-typo-column-keyword",
  meta: {
    type: "problem",
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
      if (entry.type === AST_NODE_TYPES.Literal && typeof entry.value === "string") {
        reportIfTypo(entry, entry.value);
        return;
      }
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
      // No autofix: `columns` is not FlowPanel-exclusive and a lowercase column
      // can be intentional, so `eslint --fix` must not rewrite it silently.
      context.report({ node, messageId: "typo", data: { actual: raw, suggested } });
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
