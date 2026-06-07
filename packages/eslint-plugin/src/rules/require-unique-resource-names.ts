import { AST_NODE_TYPES, type TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../create-rule.js";

type MessageId = "duplicate";

const rule = createRule<[], MessageId>({
  name: "require-unique-resource-names",
  meta: {
    type: "problem",
    docs: {
      description:
        "Within `defineAdmin({ resources })`, every `resource()` must have a unique name.",
    },
    messages: {
      duplicate:
        'Duplicate resource name "{{name}}". Each `resource()` in `defineAdmin` must have a unique name.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node: TSESTree.CallExpression): void {
        if (!isDefineAdminCall(node)) return;
        const arg = node.arguments[0];
        if (!arg || arg.type !== AST_NODE_TYPES.ObjectExpression) return;
        const resourcesProp = findPropertyByName(arg, "resources");
        if (!resourcesProp) return;
        if (resourcesProp.value.type !== AST_NODE_TYPES.ArrayExpression) return;

        const seen = new Map<string, TSESTree.Node[]>();
        for (const el of resourcesProp.value.elements) {
          if (!el || el.type !== AST_NODE_TYPES.CallExpression) continue;
          if (!isResourceCall(el)) continue;
          const name = extractResourceName(el);
          if (!name) continue;
          const list = seen.get(name) ?? [];
          list.push(el);
          seen.set(name, list);
        }

        for (const [name, nodes] of seen) {
          if (nodes.length < 2) continue;
          for (const offender of nodes) {
            context.report({
              node: offender,
              messageId: "duplicate",
              data: { name },
            });
          }
        }
      },
    };
  },
});

function isDefineAdminCall(node: TSESTree.CallExpression): boolean {
  const callee = node.callee;
  if (callee.type === AST_NODE_TYPES.Identifier) {
    return callee.name === "defineAdmin" || callee.name === "defineFlowPanel";
  }
  if (callee.type === AST_NODE_TYPES.MemberExpression && !callee.computed) {
    const prop = callee.property;
    if (prop.type === AST_NODE_TYPES.Identifier) {
      return prop.name === "defineAdmin" || prop.name === "defineFlowPanel";
    }
  }
  return false;
}

function isResourceCall(node: TSESTree.CallExpression): boolean {
  const callee = node.callee;
  if (callee.type === AST_NODE_TYPES.Identifier) return callee.name === "resource";
  if (callee.type === AST_NODE_TYPES.MemberExpression && !callee.computed) {
    const prop = callee.property;
    if (prop.type === AST_NODE_TYPES.Identifier) return prop.name === "resource";
  }
  return false;
}

function extractResourceName(call: TSESTree.CallExpression): string | null {
  const opts = call.arguments[1];
  if (!opts || opts.type !== AST_NODE_TYPES.ObjectExpression) return null;
  const nameProp = findPropertyByName(opts, "name");
  if (!nameProp) return null;
  if (nameProp.value.type === AST_NODE_TYPES.Literal && typeof nameProp.value.value === "string") {
    return nameProp.value.value;
  }
  return null;
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

export default rule;
