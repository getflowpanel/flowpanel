import { AST_NODE_TYPES, type TSESTree } from "@typescript-eslint/utils";
import { asStringLiteral, findPropertyByName } from "../ast-utils";
import { createRule } from "../create-rule";

type MessageId = "needsConfirm";

const rule = createRule<[], MessageId>({
  name: "audit-row-action-needs-confirm",
  meta: {
    type: "problem",
    docs: {
      description: "Destructive row/bulk actions must declare a `confirm` message.",
    },
    messages: {
      needsConfirm:
        'Destructive {{kind}} action requires a `confirm` property; an action with `variant: "destructive"` should always confirm before running.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      Property(node: TSESTree.Property): void {
        const kind = actionsArrayKind(node);
        if (!kind) return;
        if (node.value.type !== AST_NODE_TYPES.ArrayExpression) return;

        for (const entry of node.value.elements) {
          if (!entry || entry.type !== AST_NODE_TYPES.ObjectExpression) continue;
          const variantProp = findPropertyByName(entry, "variant");
          if (!variantProp) continue;
          if (asStringLiteral(variantProp.value) !== "destructive") continue;
          const confirmProp = findPropertyByName(entry, "confirm");
          if (confirmProp) continue;
          context.report({
            node: entry,
            messageId: "needsConfirm",
            data: { kind: kind === "bulkActions" ? "bulk" : "row" },
          });
        }
      },
    };
  },
});

function actionsArrayKind(node: TSESTree.Property): "actions" | "bulkActions" | null {
  const key = node.key;
  if (key.type === AST_NODE_TYPES.Identifier) {
    if (key.name === "actions") return "actions";
    if (key.name === "bulkActions") return "bulkActions";
  }
  if (key.type === AST_NODE_TYPES.Literal) {
    if (key.value === "actions") return "actions";
    if (key.value === "bulkActions") return "bulkActions";
  }
  return null;
}

export default rule;
