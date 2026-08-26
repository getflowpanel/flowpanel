import { AST_NODE_TYPES, type TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../create-rule";

type MessageId = "preferShorthand";

const rule = createRule<[], MessageId>({
  name: "prefer-shorthand-filter",
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: {
      description:
        "Prefer the `options: ['a', 'b']` shorthand when every filter option has label === value.",
    },
    messages: {
      preferShorthand: "Filter options where label === value can be written as a string array.",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      Property(node: TSESTree.Property): void {
        if (!isFiltersProperty(node)) return;
        if (node.value.type !== AST_NODE_TYPES.ArrayExpression) return;

        for (const filterEntry of node.value.elements) {
          if (!filterEntry || filterEntry.type !== AST_NODE_TYPES.ObjectExpression) continue;
          const optionsProp = findPropertyByName(filterEntry, "options");
          if (!optionsProp) continue;
          if (optionsProp.value.type !== AST_NODE_TYPES.ArrayExpression) continue;

          const arr = optionsProp.value;
          if (arr.elements.length === 0) continue;

          const literals: string[] = [];
          let allMatch = true;
          for (const el of arr.elements) {
            if (!el || el.type !== AST_NODE_TYPES.ObjectExpression) {
              allMatch = false;
              break;
            }
            const labelProp = findPropertyByName(el, "label");
            const valueProp = findPropertyByName(el, "value");
            if (!labelProp || !valueProp) {
              allMatch = false;
              break;
            }
            const labelLit = asStringLiteral(labelProp.value);
            const valueLit = asStringLiteral(valueProp.value);
            if (labelLit === null || valueLit === null || labelLit !== valueLit) {
              allMatch = false;
              break;
            }
            if (el.properties.length !== 2) {
              allMatch = false;
              break;
            }
            literals.push(labelLit);
          }

          if (!allMatch) continue;

          context.report({
            node: arr,
            messageId: "preferShorthand",
            fix(fixer) {
              const replacement = `[${literals.map((s) => JSON.stringify(s)).join(", ")}]`;
              return fixer.replaceText(arr, replacement);
            },
          });
        }
      },
    };
  },
});

function isFiltersProperty(node: TSESTree.Property): boolean {
  const key = node.key;
  if (key.type === AST_NODE_TYPES.Identifier) return key.name === "filters";
  if (key.type === AST_NODE_TYPES.Literal) return key.value === "filters";
  return false;
}

function findPropertyByName(
  obj: TSESTree.ObjectExpression,
  name: string,
): TSESTree.Property | null {
  for (const prop of obj.properties) {
    if (prop.type !== AST_NODE_TYPES.Property) continue;
    const key = prop.key;
    if (key.type === AST_NODE_TYPES.Identifier && key.name === name) return prop;
    if (key.type === AST_NODE_TYPES.Literal && key.value === name) return prop;
  }
  return null;
}

function asStringLiteral(node: TSESTree.Node): string | null {
  if (node.type === AST_NODE_TYPES.Literal && typeof node.value === "string") {
    return node.value;
  }
  return null;
}

export default rule;
