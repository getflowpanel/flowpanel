import { AST_NODE_TYPES, ASTUtils, type TSESLint, type TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../create-rule.js";

type MessageId = "duplicate" | "duplicateRef";

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
      duplicateRef:
        "`{{name}}` is listed more than once in `resources`. Each entry must be a distinct resource.",
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

        // Two key spaces on purpose: a name read off a `resource()` call and a
        // bare identifier from the decomposed layout are not comparable, so
        // collapsing them would report a false duplicate.
        const byName = new Map<string, TSESTree.Node[]>();
        const byRef = new Map<string, TSESTree.Node[]>();

        for (const el of resourcesProp.value.elements) {
          if (!el) continue;
          if (el.type === AST_NODE_TYPES.CallExpression) {
            if (!isResourceCall(el)) continue;
            const name = extractResourceName(el);
            if (name) push(byName, name, el);
            continue;
          }
          if (el.type !== AST_NODE_TYPES.Identifier) continue;
          const resolved = resolveIdentifierToResourceCall(context, el);
          if (resolved) {
            const name = extractResourceName(resolved);
            if (name) push(byName, name, el);
            continue;
          }
          push(byRef, el.name, el);
        }

        report(byName, "duplicate");
        report(byRef, "duplicateRef");

        function report(seen: Map<string, TSESTree.Node[]>, messageId: MessageId): void {
          for (const [name, nodes] of seen) {
            if (nodes.length < 2) continue;
            for (const offender of nodes) {
              context.report({ node: offender, messageId, data: { name } });
            }
          }
        }
      },
    };
  },
});

function push(map: Map<string, TSESTree.Node[]>, key: string, node: TSESTree.Node): void {
  const list = map.get(key) ?? [];
  list.push(node);
  map.set(key, list);
}

/** `const users = resource(...)` in the same file — imported names stay unresolved. */
function resolveIdentifierToResourceCall(
  context: Readonly<TSESLint.RuleContext<MessageId, []>>,
  id: TSESTree.Identifier,
): TSESTree.CallExpression | null {
  const variable = ASTUtils.findVariable(context.sourceCode.getScope(id), id);
  const def = variable?.defs[0];
  if (!def || def.type !== "Variable") return null;
  const init = def.node.init;
  if (!init || init.type !== AST_NODE_TYPES.CallExpression) return null;
  return isResourceCall(init) ? init : null;
}

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

/** Mirrors `resolveResourceName`: `options.name` wins, then a string ref. */
function extractResourceName(call: TSESTree.CallExpression): string | null {
  const opts = call.arguments[1];
  if (opts && opts.type === AST_NODE_TYPES.ObjectExpression) {
    const nameProp = findPropertyByName(opts, "name");
    if (
      nameProp &&
      nameProp.value.type === AST_NODE_TYPES.Literal &&
      typeof nameProp.value.value === "string"
    ) {
      return nameProp.value.value;
    }
  }
  const ref = call.arguments[0];
  if (ref && ref.type === AST_NODE_TYPES.Literal && typeof ref.value === "string") {
    return ref.value;
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
